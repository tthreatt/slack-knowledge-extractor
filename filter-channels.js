const fs = require('fs');

// Read the channels file
const channels = JSON.parse(fs.readFileSync('channels.json', 'utf8'));

// Filter channels (in this case, they're all public channels already)
const filtered = channels.filter(channel => {
    // Keep only channels with more than 1 member (optional)
    return channel.memberCount > 1;
});

// Sort by member count (optional)
filtered.sort((a, b) => b.memberCount - a.memberCount);

// Save the filtered channels
fs.writeFileSync('filtered-channels.json', JSON.stringify(filtered, null, 2));

console.log(`Original channels: ${channels.length}`);
console.log(`Filtered channels: ${filtered.length}`);
console.log('Filtered channels saved to filtered-channels.json'); 