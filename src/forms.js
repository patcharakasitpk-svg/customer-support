// A form field sent more than once arrives as an array; treat anything but a string as empty.
function text(value) {
  return typeof value === 'string' ? value : '';
}

module.exports = { text };
