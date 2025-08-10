import { ComprehendClient, DetectKeyPhrasesCommand } from '@aws-sdk/client-comprehend';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getAWSConfig } from './awsConfig';

export const detectKeyPhrases = async (
  text: string,
  languageCode?: string
): Promise<string[]> => {
  if (!text || !text.trim()) return [];

  const aws = getAWSConfig();
  const session = await fetchAuthSession();
  const creds = session.credentials;
  if (!creds) throw new Error('Not authenticated');

  const client = new ComprehendClient({
    region: aws.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });

  // Comprehend has a 5000-byte limit; trim input conservatively
  const input = text.slice(0, 4500);
  const lang = (languageCode || 'en') as any; // keep simple default

  const cmd = new DetectKeyPhrasesCommand({ Text: input, LanguageCode: lang });
  const res = await client.send(cmd);

  const phrases = (res.KeyPhrases || [])
    .map((k) => (k?.Text ? String(k.Text).trim() : ''))
    .filter(Boolean);
  // Normalize and uniq (case-insensitive)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of phrases) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
};
