const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

const client = new SecretManagerServiceClient();

async function getSecret(secretName) {
  try {
    const name = `projects/civil-forge-403609/secrets/${secretName}/versions/latest`;
    const [version] = await client.accessSecretVersion({name});
    return version.payload.data.toString();
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error);
    throw error;
  }
}

async function getCredentials() {
  const username = await getSecret('worthpoint-username');
  const password = await getSecret('worthpoint-password');
  return { username, password };
}

module.exports = { getCredentials };