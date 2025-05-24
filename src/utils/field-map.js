const fieldMap = {
  lotNumber: 'ln',
  title: 't',
  description: 'd',
  hammerPrice: 'hp',
  estimateLow: 'eL',
  estimateHigh: 'eH',
  currency: 'c',
  imagePath: 'img',
  auctionHouse: 'ah',
  date: 'dt'
};

/**
 * Obfuscate keys in a single lot object.
 * @param {object} lot
 * @returns {object}
 */
function obfuscateLot(lot) {
  if (!lot || typeof lot !== 'object') return {};
  const obfuscated = {};
  for (const [origKey, value] of Object.entries(lot)) {
    const obfKey = fieldMap[origKey] || origKey; // keep key if not mapped
    obfuscated[obfKey] = value;
  }
  return obfuscated;
}

/**
 * De-obfuscate keys in a lot object.
 * @param {object} lot
 * @returns {object}
 */
function deobfuscateLot(lot) {
  if (!lot || typeof lot !== 'object') return {};
  const deobfuscated = {};
  for (const [key, value] of Object.entries(lot)) {
    // find original by reverse lookup
    const origKey = Object.keys(fieldMap).find(k => fieldMap[k] === key) || key;
    deobfuscated[origKey] = value;
  }
  return deobfuscated;
}

module.exports = {
  fieldMap,
  obfuscateLot,
  deobfuscateLot
};