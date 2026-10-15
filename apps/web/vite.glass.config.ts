import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeConfig } from 'vite';
import baseConfig from './vite.config.js';

export default mergeConfig(baseConfig, {
  plugins: [{
    name: 'fairtrip-offline-preview',
    apply: 'build',
    closeBundle() {
      const directory = fileURLToPath(new URL('./dist/glass-preview/', import.meta.url));
      const files = readdirSync(join(directory, 'assets'));
      const scriptName = files.find(name => name.endsWith('.js'));
      const styleName = files.find(name => name.endsWith('.css'));
      if (scriptName === undefined || styleName === undefined) throw new Error('Missing glass preview assets');
      const script = readFileSync(join(directory, 'assets', scriptName), 'utf8').replace(/<\/script/gi, '<\\/script');
      const style = readFileSync(join(directory, 'assets', styleName), 'utf8').replace(/<\/style/gi, '<\\/style');
      let html = readFileSync(join(directory, 'glass.html'), 'utf8');
      html = html.replace(/<script\b[^>]*src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${script}</script>`)
        .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/, () => `<style>${style}</style>`);
      const offlineControls = `<script>const observer=new MutationObserver(()=>{const button=document.querySelector('.glass-source button:nth-child(2)');if(!button)return;button.disabled=true;button.title='Live hearings are available in the connected preview';observer.disconnect()});observer.observe(document.getElementById('root'),{childList:true,subtree:true});</script>`;
      writeFileSync(join(directory, 'preview.html'), html.replace('</body>', () => `${offlineControls}</body>`));
    },
  }],
  build: {
    outDir: 'dist/glass-preview',
    rolldownOptions: {input: fileURLToPath(new URL('./glass.html', import.meta.url))},
  },
});
