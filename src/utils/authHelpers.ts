import CryptoJS from 'crypto-js';
import { getAWSConfig } from './awsConfig';

/**
 * Calculates the secret hash required for Cognito authentication when client secret is enabled
 * @param username - The username (email)
 * @returns The calculated secret hash
 */
export const calculateSecretHash = (username: string): string => {
  const config = getAWSConfig();
  const clientSecret = import.meta.env.VITE_USER_POOL_CLIENT_SECRET;
  
  if (!clientSecret) {
    throw new Error('Client secret not configured. Please add VITE_USER_POOL_CLIENT_SECRET to your .env file.');
  }
  
  const message = username + config.userPoolClientId;
  const hash = CryptoJS.HmacSHA256(message, clientSecret);
  return CryptoJS.enc.Base64.stringify(hash);
};