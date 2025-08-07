import { Amplify } from 'aws-amplify';

// Environment configuration with validation
const getEnvVar = (key: string): string => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. Please check your .env file.`);
  }
  return value;
};

// Lazy-loaded configuration to prevent startup crashes
let configCache: any = null;

export const getAWSConfig = () => {
  if (configCache) return configCache;
  
  try {
    configCache = {
      region: getEnvVar('VITE_REGION'),
      s3BucketName: getEnvVar('VITE_S3_BUCKET_NAME'),
      dynamoTableName: getEnvVar('VITE_DYNAMODB_TABLE_NAME'),
      userPoolId: getEnvVar('VITE_USER_POOL_ID'),
      userPoolClientId: getEnvVar('VITE_USER_POOL_CLIENT_ID'),
      identityPoolId: getEnvVar('VITE_IDENTITY_POOL_ID'),
    };

    // Configure Amplify only when we have valid config
    Amplify.configure({
      Auth: {
        Cognito: {
          region: configCache.region,
          userPoolId: configCache.userPoolId,
          userPoolClientId: configCache.userPoolClientId,
          identityPoolId: configCache.identityPoolId,
        }
      }
    });

    return configCache;
  } catch (error) {
    throw new Error(`AWS Configuration Error: ${error.message}\n\nPlease create a .env file with the required AWS variables. See .env.example for reference.`);
  }
};

// Export for backward compatibility
export const awsConfig = getAWSConfig;