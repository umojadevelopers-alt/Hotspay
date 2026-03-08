'use strict';

const crypto = require('crypto');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const Voucher = require('../models/Voucher');
const Profile = require('../models/Profile');
const mikrotikService = require('./mikrotikService');

/** Characters used for random username/password generation. */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous chars (0,O,I,1)

/**
 * Generate a random alphanumeric string of given length.
 * Uses crypto.randomInt to avoid modulo bias.
 * @param {number} length
 * @returns {string}
 */
function randomString(length) {
  return Array.from({ length }, () => CHARSET[crypto.randomInt(CHARSET.length)]).join('');
}

const voucherService = {
  /**
   * Generate a batch of vouchers and persist them to the database.
   * @param {number} count - Number of vouchers to generate
   * @param {number} profileId - Profile ID
   * @param {number} routerId - Router ID
   * @param {number} amount - Price per voucher
   * @returns {Promise<Array>} Inserted voucher records
   */
  async generateVouchers(count, profileId, routerId, amount) {
    if (count < 1 || count > 1000) {
      throw new Error('count must be between 1 and 1000');
    }

    const profile = await Profile.findById(profileId);
    if (!profile) throw new Error(`Profile ${profileId} not found`);

    const vouchers = [];

    for (let i = 0; i < count; i++) {
      vouchers.push({
        username: randomString(8),
        password: randomString(8),
        profile_id: profileId,
        router_id: routerId,
        amount,
        comment: `Batch generated – ${profile.name}`,
      });
    }

    await Voucher.createBatch(vouchers);

    // Return the freshly created records by fetching via username list
    const inserted = [];
    for (const v of vouchers) {
      const record = await Voucher.findByUsername(v.username);
      if (record) inserted.push(record);
    }

    return inserted;
  },

  /**
   * Generate a QR code for a voucher and return it as a base64 data URL.
   * The QR code encodes: "username:password" for easy login.
   * @param {Object} voucher - Voucher DB record
   * @returns {Promise<string>} Base64 data URL (image/png)
   */
  async generateQRCode(voucher) {
    const content = `${voucher.username}:${voucher.password}`;
    const dataUrl = await QRCode.toDataURL(content, {
      errorCorrectionLevel: 'M',
      width: 200,
      margin: 1,
    });
    return dataUrl;
  },

  /**
   * Generate a PDF scratch-card sheet for a list of vouchers.
   * Layout: 6 vouchers per page in a 2×3 grid.
   *
   * @param {Array<Object>} vouchers - Array of voucher DB records
   * @param {Object} [options]
   * @param {string} [options.ssid] - Wi-Fi SSID to print on the card
   * @param {string} [options.title] - Header title
   * @returns {Promise<Buffer>} PDF file buffer
   */
  async generateVoucherPDF(vouchers, options = {}) {
    const { ssid = process.env.APP_NAME || 'Hotspay', title = 'Wi-Fi Vouchers' } = options;

    // Pre-generate QR codes outside the Promise executor (await is not allowed there)
    const qrMap = {};
    for (const v of vouchers) {
      try {
        qrMap[v.id || v.username] = await this.generateQRCode(v);
      } catch {
        qrMap[v.id || v.username] = null;
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Page dimensions
        const pageW = doc.page.width;
        const pageH = doc.page.height;
        const margin = 30;
        const cols = 2;
        const rows = 3;
        const cardW = (pageW - margin * 2 - (cols - 1) * 10) / cols;
        const cardH = (pageH - margin * 2 - (rows - 1) * 10) / rows;

        for (let i = 0; i < vouchers.length; i++) {
          const posOnPage = i % 6;

          if (posOnPage === 0 && i !== 0) doc.addPage();

          const col = posOnPage % cols;
          const row = Math.floor(posOnPage / cols);
          const x = margin + col * (cardW + 10);
          const y = margin + row * (cardH + 10);

          // Card border
          doc
            .rect(x, y, cardW, cardH)
            .lineWidth(1)
            .strokeColor('#cccccc')
            .stroke();

          const v = vouchers[i];
          let curY = y + 10;

          // Title / SSID
          doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold');
          doc.text(title, x + 5, curY, { width: cardW - 10, align: 'center' });
          curY += 14;

          doc.fontSize(9).fillColor('#555555').font('Helvetica');
          doc.text(`SSID: ${ssid}`, x + 5, curY, { width: cardW - 10, align: 'center' });
          curY += 12;

          // Divider
          doc.moveTo(x + 5, curY).lineTo(x + cardW - 5, curY).strokeColor('#eeeeee').stroke();
          curY += 6;

          // Username / password
          doc.fontSize(8).fillColor('#888888').font('Helvetica');
          doc.text('Username:', x + 5, curY);
          doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold');
          doc.text(v.username, x + 65, curY);
          curY += 14;

          doc.fontSize(8).fillColor('#888888').font('Helvetica');
          doc.text('Password:', x + 5, curY);
          doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold');
          doc.text(v.password, x + 65, curY);
          curY += 14;

          // Duration / price
          doc.fontSize(8).fillColor('#555555').font('Helvetica');
          if (v.profile_name) {
            doc.text(`Plan: ${v.profile_name}`, x + 5, curY);
            curY += 12;
          }
          if (v.amount) {
            doc.text(`Price: ${Number(v.amount).toFixed(2)}`, x + 5, curY);
            curY += 12;
          }

          // QR code (pre-generated)
          const qrDataUrl = qrMap[v.id || v.username];
          if (qrDataUrl) {
            try {
              const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
              const qrBuffer = Buffer.from(base64Data, 'base64');
              const qrSize = Math.min(cardW - 10, cardH - (curY - y) - 10);
              if (qrSize > 20) {
                doc.image(qrBuffer, x + (cardW - qrSize) / 2, curY, {
                  width: qrSize,
                  height: qrSize,
                });
              }
            } catch (imgErr) {
              console.warn(`[voucherService] QR image embed failed for ${v.username}: ${imgErr.message}`);
            }
          }
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * Push a single voucher to the MikroTik router.
   * @param {Object} voucher - Voucher DB record (must include profile_name and router_id)
   * @returns {Promise<Array>}
   */
  async pushVoucherToMikrotik(voucher) {
    return mikrotikService.createHotspotUser(voucher.router_id, {
      username: voucher.username,
      password: voucher.password,
      profile: voucher.profile_name || '',
      comment: voucher.comment || '',
    });
  },
};

module.exports = voucherService;
