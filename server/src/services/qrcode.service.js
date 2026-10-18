const QRCode = require('qrcode');

// Builds a UPI-style deep link and renders it as a QR code data URL.
// This is a simulated payment string for demo purposes (no real payment gateway).
async function buildPaymentQr(booking, venueName) {
  const upiString = `upi://pay?pa=quadrangle.campus@fictionalbank&pn=QuadrangleCampus&am=${booking.price}&cu=INR&tn=Booking-${booking._id}`;
  const dataUrl = await QRCode.toDataURL(upiString, {
    margin: 1,
    width: 220,
    color: { dark: '#12213B', light: '#FFFFFF' },
  });
  return { dataUrl, upiString, amount: booking.price, venueName };
}

module.exports = { buildPaymentQr };
