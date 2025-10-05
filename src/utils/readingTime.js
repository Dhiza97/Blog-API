// count words and divide by 200 wpm
function calculateReadingTime(text) {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.ceil(words / 200) || 1;
  return minutes;
}

module.exports = { calculateReadingTime };