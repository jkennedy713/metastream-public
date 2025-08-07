import { Amplify } from 'aws-amplify';

// Environment configuration with validation
const getEnvVar = (key: string): string => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const awsConfig = {
  region: getEnvVar('VITE_REGION'),
  s3BucketName: getEnvVar('VITE_S3_BUCKET_NAME'),
  dynamoTableName: getEnvVar('VITE_DYNAMODB_TABLE_NAME'),
  userPoolId: getEnvVar('VITE_USER_POOL_ID'),
  userPoolClientId: getEnvVar('VITE_USER_POOL_CLIENT_ID'),
  identityPoolId: getEnvVar('VITE_IDENTITY_POOL_ID'),
};

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: awsConfig.userPoolId,
      userPoolClientId: awsConfig.userPoolClientId,
      identityPoolId: awsConfig.identityPoolId,
    }
  }
});

export default awsConfig;