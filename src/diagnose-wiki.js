import settings from '../config/settings.json' with { type: 'json' };
import { fetchWiki } from './wiki.js';

const rows = await fetchWiki(settings, console.log);
console.log(`Wiki診断成功: ${rows.length}件`);
console.log(rows.slice(0, 5));
