import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
process.loadEnvFile('.env');
const file='.env.video-worker.local';
if(!existsSync(file))writeFileSync(file,`VIDEO_WORKER_SUPABASE_URL=${process.env.EXPO_PUBLIC_SUPABASE_URL}\nVIDEO_WORKER_TOKEN=${randomBytes(32).toString('hex')}\n`,{mode:0o600});
process.loadEnvFile(file);
mkdirSync('.tmp',{recursive:true});
const secretPath='.tmp/video-worker-secret.env';writeFileSync(secretPath,`VIDEO_WORKER_TOKEN=${process.env.VIDEO_WORKER_TOKEN}\n`,{mode:0o600});
const cli=process.env.SUPABASE_CLI||'supabase';
try{execFileSync(cli,['secrets','set','--env-file',secretPath],{stdio:['ignore','pipe','pipe'],windowsHide:true});console.log('Local worker token configured. No Groq or database admin keys are stored on the worker.');}
finally{const {unlinkSync}=await import('node:fs');unlinkSync(secretPath);}
