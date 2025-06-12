const projectId = 'project:discord:GEpk5t8yZkQzaWYDHDZHS';

console.log('Original project ID:', projectId);
console.log('URL encoded:', encodeURIComponent(projectId));
console.log('Base64 encoded:', Buffer.from(projectId).toString('base64'));
console.log('Replace colons with dashes:', projectId.replace(/:/g, '-'));

console.log('\nTo test different URL formats:');
console.log('1. With colons (will fail):', `http://localhost:3000/discord/share/${projectId}`);
console.log('2. URL encoded (will fail):', `http://localhost:3000/discord/share/${encodeURIComponent(projectId)}`);
console.log('3. Replace colons:', `http://localhost:3000/discord/share/${projectId.replace(/:/g, '-')}`);

console.log('\nThe issue: Next.js dynamic routes cannot handle colons in URL paths.');
console.log('Solution: We need to encode the project ID before putting it in the URL.'); 