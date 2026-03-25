import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Plugin, defineConfig } from 'vite';
import { buildAiParseResponse } from './mocks/ai-endpoint';

const rootDir = path.resolve(__dirname, '../..');

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];

    request.on('data', (chunk: Uint8Array) => {
      chunks.push(chunk);
    });

    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

const aiParseMockPlugin: Plugin = {
  name: 'e2e-ai-parse-mock',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith('/api/ai/parse')) {
        next();
        return;
      }

      if (request.method !== 'POST') {
        sendJson(response, 405, { message: 'Method not allowed.' });
        return;
      }

      try {
        const rawBody = await readRequestBody(request);
        const parsedBody = JSON.parse(rawBody) as unknown;
        const aiResponse = buildAiParseResponse(parsedBody);
        sendJson(response, 200, aiResponse);
      } catch (error) {
        sendJson(response, 500, {
          message: `E2E AI mock failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    });
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), aiParseMockPlugin],
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify('e2e-mock-key'),
    'process.env.VITE_INGREDIENT_IMAGE_BASE_URL': JSON.stringify('https://example.com/ingredients'),
    'import.meta.env.VITE_INGREDIENT_IMAGE_BASE_URL': JSON.stringify('https://example.com/ingredients'),
  },
  resolve: {
    alias: {
      '@': rootDir,
      '@google/genai': path.resolve(__dirname, './mocks/google-genai.ts'),
      'firebase/app': path.resolve(__dirname, './mocks/firebase-app.ts'),
      'firebase/auth': path.resolve(__dirname, './mocks/firebase-auth.ts'),
      'firebase/firestore': path.resolve(__dirname, './mocks/firebase-firestore.ts'),
    },
  },
  server: {
    hmr: false,
    host: '127.0.0.1',
    port: 3000,
  },
});
