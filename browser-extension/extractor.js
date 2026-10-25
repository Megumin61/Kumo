// Injected into the user-invoked active tab. Keep this function self-contained.
async function extractKumoPage(pageState = {}) {
  const clean = value => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const escapeMd = value => String(value || '').replace(/([\\`*_[\]<>])/g, '\\$1');
  const escapeHtml = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const absolute = value => {
    if (!String(value || '').trim()) return '';
    try {
      const url = new URL(value, location.href);
      return /^(https?):$/.test(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const largestSrcsetUrl = value => {
    const candidates = String(value || '').split(',').map(item => {
      const [url, descriptor = ''] = item.trim().split(/\s+/);
      const score = Number.parseFloat(descriptor) || 0;
      return {url: absolute(url), score};
    }).filter(item => item.url);
    return candidates.sort((a, b) => b.score - a.score)[0]?.url || '';
  };
  const imageUrl = image => absolute(
    image?.getAttribute?.('data-original') ||
    image?.getAttribute?.('data-src') ||
    image?.getAttribute?.('data-lazy-src') ||
    largestSrcsetUrl(image?.getAttribute?.('srcset') || image?.closest?.('picture')?.querySelector?.('source[srcset]')?.getAttribute('srcset')) ||
    image?.currentSrc ||
    image?.getAttribute?.('src') ||
    ''
  );
  const imageKey = value => {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname.replace(/!.*$/, '')}`;
    } catch { return value; }
  };
  const meta = (key, attribute = 'property') => document.querySelector(`meta[${attribute}="${key}"]`)?.content?.trim() || '';

  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap(node => {
      try {
        const parsed = JSON.parse(node.textContent || 'null');
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch { return []; }
    })
    .flatMap(value => value?.['@graph'] || value || [])
    .find(value => /Article|Posting|NewsArticle|BlogPosting|VideoObject/i.test(String(value?.['@type'] || ''))) || {};

  const hostname = location.hostname.replace(/^www\./, '');
  const xhs = /(^|\.)xiaohongshu\.com$/.test(hostname);
  const bili = /(^|\.)bilibili\.com$/.test(hostname);
  const wechat = /(^|\.)mp\.weixin\.qq\.com$/.test(hostname);
  const x = /(^|\.)(x|twitter)\.com$/.test(hostname);
  const douyin = /(^|\.)douyin\.com$/.test(hostname);
  const tiktok = /(^|\.)tiktok\.com$/.test(hostname);
  const youtube = /(^|\.)(youtube\.com|youtu\.be)$/.test(hostname);
  const platformId = xhs ? 'xiaohongshu' : x ? 'x' : douyin ? 'douyin' : tiktok ? 'tiktok' : bili ? 'bilibili' : wechat ? 'wechat' : youtube ? 'youtube' : 'generic';
  const platform = xhs ? '小红书' : x ? 'X' : douyin ? '抖音' : tiktok ? 'TikTok' : bili ? 'B站' : wechat ? '微信公众号' : youtube ? 'YouTube' : hostname;
  const currentUrl = new URL(location.href);
  const sourceIdentity = (() => {
    const path = currentUrl.pathname;
    const rules = [
      ['xiaohongshu', path.match(/^\/(?:explore|discovery\/item)\/([a-z0-9]+)/i), id => `https://www.xiaohongshu.com/explore/${id}`],
      ['x', path.match(/^\/([^/]+)\/status\/(\d+)/i), match => `https://x.com/${match[1]}/status/${match[2]}`],
      ['douyin', path.match(/^\/(?:video|note)\/(\d+)/i), id => `https://www.douyin.com/${path.startsWith('/note/') ? 'note' : 'video'}/${id}`],
      ['tiktok', path.match(/^\/@([^/]+)\/video\/(\d+)/i), match => `https://www.tiktok.com/@${match[1]}/video/${match[2]}`],
      ['bilibili', path.match(/^\/video\/(BV[a-z0-9]+)/i), id => `https://www.bilibili.com/video/${id}`]
    ];
    for (const [id, match, makeUrl] of rules) {
      if (platformId !== id || !match) continue;
      const sourceId = id === 'x' || id === 'tiktok' ? match[2] : match[1];
      return {sourceId, sourceUrl: makeUrl(id === 'x' || id === 'tiktok' ? match : sourceId), dedupeSafe: true};
    }
    if (youtube) {
      const sourceId = hostname === 'youtu.be' ? path.split('/').filter(Boolean)[0] : currentUrl.searchParams.get('v') || path.match(/^\/shorts\/([^/]+)/)?.[1];
      if (sourceId) return {sourceId, sourceUrl: `https://www.youtube.com/watch?v=${sourceId}`, dedupeSafe: true};
    }
    if (wechat) {
      const keys = ['__biz', 'mid', 'idx', 'sn'];
      const params = new URLSearchParams();
      keys.forEach(key => { if (currentUrl.searchParams.has(key)) params.set(key, currentUrl.searchParams.get(key)); });
      if (params.get('__biz') && params.get('mid')) return {sourceId: `${params.get('__biz')}:${params.get('mid')}:${params.get('idx') || '1'}`, sourceUrl: `${currentUrl.origin}${path}?${params}`, dedupeSafe: true};
    }
    return {sourceId: '', sourceUrl: '', dedupeSafe: false};
  })();

  // Xiaohongshu lazily creates carousel media. Visit every pagination item so a
  // single user click captures the full post, then restore the slide they were on.
  const xhsNote = xhs && pageState.sourceId === sourceIdentity.sourceId ? pageState.xhsNote : null;
  const coreState = pageState.sourceId === sourceIdentity.sourceId ? pageState.core : null;
  const xhsGallerySnapshot = {expected: xhsNote?.expectedImages || 0, images: [...(xhsNote?.images || [])], videos: [...(xhsNote?.videos || [])]};
  if (xhs) {
    const gallery = document.querySelector('#noteContainer .swiper, #noteContainer [class*="slider"], #noteContainer');
    const bullets = gallery ? [...gallery.querySelectorAll('.swiper-pagination-bullet, [class*="pagination"] [role="button"]')] : [];
    const uniqueBullets = [...new Set(bullets)];
    xhsGallerySnapshot.expected = Math.max(xhsGallerySnapshot.expected, uniqueBullets.length);
    const activeIndex = Math.max(0, uniqueBullets.findIndex(node => node.classList.contains('swiper-pagination-bullet-active') || node.getAttribute('aria-current') === 'true'));
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const collectGallery = () => {
      const scope = gallery || document.querySelector('#noteContainer');
      if (!scope) return;
      scope.querySelectorAll('.swiper-slide img, .swiper-wrapper img, [class*="carousel"] img').forEach(image => {
        const url = imageUrl(image);
        if (url) xhsGallerySnapshot.images.push({url, alt: clean(image.alt), width: image.naturalWidth || image.width || 0, height: image.naturalHeight || image.height || 0});
      });
      scope.querySelectorAll('.swiper-slide video, .swiper-wrapper video, [class*="carousel"] video').forEach(video => {
        const url = video.currentSrc || video.src || video.querySelector('source')?.src || '';
        if (url && !xhsGallerySnapshot.videos.some(item => item.url === url)) xhsGallerySnapshot.videos.push({url, type: video.getAttribute('type') || '', poster: video.poster || ''});
      });
    };
    if (!xhsNote?.images?.length || xhsNote.images.length < xhsGallerySnapshot.expected) collectGallery();
    if (uniqueBullets.length > 1 && xhsGallerySnapshot.images.length < xhsGallerySnapshot.expected) {
      for (let index = 0; index < uniqueBullets.length; index++) {
        const before = new Set(xhsGallerySnapshot.images.map(image => imageKey(image.url))).size + xhsGallerySnapshot.videos.length;
        uniqueBullets[index].dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
        for (let attempt = 0; attempt < 10; attempt++) {
          await wait(100);
          collectGallery();
          const after = new Set(xhsGallerySnapshot.images.map(image => imageKey(image.url))).size + xhsGallerySnapshot.videos.length;
          if (after > before || index === activeIndex) break;
        }
      }
      uniqueBullets[activeIndex]?.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
      await wait(80);
    }
  }
  const selectors = xhs
    ? ['#noteContainer', '.note-detail', '.note-content', 'main', 'article']
    : x
      ? ['article[data-testid="tweet"]', 'main article', 'article', 'main']
      : douyin
        ? ['[data-e2e="detail-video-info"]', '[data-e2e="video-desc"]', 'article', 'main']
        : tiktok
          ? ['[data-e2e="browse-video-desc"]', '[data-e2e="video-desc"]', 'article', 'main']
    : bili
      ? ['.video-info-container', '.video-desc-container', '#v_desc', 'main', 'article']
      : wechat
        ? ['#js_content', '.rich_media_content', 'article', 'main']
        : ['article', 'main', '[role="main"]', '.post-content', '.article-content', '.entry-content', '.content'];

  const candidates = selectors
    .flatMap(selector => [...document.querySelectorAll(selector)])
    .filter(node => node && node.getBoundingClientRect().width > 0);
  const score = node => {
    const text = clean(node.innerText || '').slice(0, 80000);
    const linked = clean([...node.querySelectorAll('a')].map(link => link.innerText).join(' '));
    const paragraphs = node.querySelectorAll('p,li,blockquote').length;
    return Math.min(text.length, 30000) - Math.min(linked.length, 6000) * .45 + Math.min(paragraphs, 80) * 16;
  };
  const preferredRoot = x && sourceIdentity.sourceId
    ? [...document.querySelectorAll('article[data-testid="tweet"]')].find(node => [...node.querySelectorAll('time')].some(time => {
      const href = time.closest('a')?.getAttribute('href') || '';
      return href.match(/\/status\/(\d+)/)?.[1] === sourceIdentity.sourceId;
    })) || candidates.find(node => node.querySelector(`a[href$="/status/${sourceIdentity.sourceId}"]`))
    : null;
  const specificRoot = xhs ? document.querySelector('#noteContainer') : wechat ? document.querySelector('#js_content, .rich_media_content') : null;
  const root = x ? preferredRoot || document.createElement('article') : specificRoot || candidates.sort((a, b) => score(b) - score(a))[0] || document.body;
  const clone = root.cloneNode(true);
  clone.querySelectorAll('script,style,noscript,nav,footer,header,aside,form,button,input,textarea,select,svg,canvas,iframe,object,embed,link,meta,[role="navigation"],[data-testid="reply"],[data-e2e*="comment"],.comment,.comments,.comment-list,.reply,.replies,.recommend,.recommendation,.sidebar,.login-modal').forEach(node => node.remove());
  clone.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'style' || name === 'srcset') node.removeAttribute(attribute.name);
    });
    if (node.hasAttribute('href')) {
      const url = absolute(node.getAttribute('href'));
      if (url) node.setAttribute('href', url); else node.removeAttribute('href');
    }
    if (node.hasAttribute('src')) {
      const url = absolute(node.getAttribute('src'));
      if (url) node.setAttribute('src', url); else node.removeAttribute('src');
    }
  });

  const inline = node => {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return String(node.textContent || '').replace(/\s+/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'img') {
      const url = imageUrl(node);
      return url ? `![${escapeMd(clean(node.getAttribute('alt')))}](${url})` : '';
    }
    const content = [...node.childNodes].map(inline).join('');
    if (tag === 'a') {
      const url = absolute(node.getAttribute('href'));
      return url && clean(content) ? `[${clean(content)}](${url})` : content;
    }
    if (tag === 'strong' || tag === 'b') return clean(content) ? `**${clean(content)}**` : '';
    if (tag === 'em' || tag === 'i') return clean(content) ? `*${clean(content)}*` : '';
    if (tag === 'code') return clean(content) ? `\`${clean(content).replace(/`/g, '\\`')}\`` : '';
    return content;
  };

  const tableMarkdown = table => {
    const rows = [...table.querySelectorAll('tr')].map(row => [...row.querySelectorAll('th,td')].map(cell => clean(cell.innerText).replace(/\|/g, '\\|'))).filter(row => row.length);
    if (!rows.length) return '';
    const width = Math.max(...rows.map(row => row.length));
    const normalized = rows.map(row => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
    return [
      `| ${normalized[0].join(' | ')} |`,
      `| ${Array(width).fill('---').join(' | ')} |`,
      ...normalized.slice(1).map(row => `| ${row.join(' | ')} |`)
    ].join('\n');
  };

  const block = node => {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return clean(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${clean(inline(node))}`;
    if (tag === 'p') return clean(inline(node));
    if (tag === 'blockquote') return clean(node.innerText).split('\n').map(line => `> ${line}`).join('\n');
    if (tag === 'pre') return `\`\`\`\n${String(node.innerText || node.textContent || '').trim()}\n\`\`\``;
    if (tag === 'table') return tableMarkdown(node);
    if (tag === 'ul' || tag === 'ol') {
      return [...node.children].filter(child => child.tagName?.toLowerCase() === 'li').map((item, index) => `${tag === 'ol' ? `${index + 1}.` : '-'} ${clean(inline(item))}`).join('\n');
    }
    if (tag === 'figure') {
      const image = node.querySelector('img');
      const url = absolute(image?.getAttribute('src'));
      const caption = clean(node.querySelector('figcaption')?.innerText || image?.getAttribute('alt'));
      return url ? `![${escapeMd(caption)}](${url})${caption ? `\n\n${caption}` : ''}` : caption;
    }
    return [...node.childNodes].map(block).filter(Boolean).join('\n\n');
  };

  let content = clean(block(clone)).slice(0, 180000);
  let contentHtml = clone.innerHTML.slice(0, 500000);
  if (x) {
    const postText = root.querySelector('[data-testid="tweetText"]');
    if (postText) {
      content = clean(postText.innerText).slice(0, 30000);
      contentHtml = postText.outerHTML.slice(0, 100000);
    }
  }
  let xhsBodyFound = true;
  if (xhs) {
    const bodyNode = document.querySelector('#detail-desc, .note-content .desc');
    const description = clean(xhsNote?.desc || bodyNode?.innerText || meta('og:description') || meta('description', 'name'));
    xhsBodyFound = Boolean(description);
    content = description.slice(0, 30000);
    const clonedBody = clone.querySelector('#detail-desc, .desc');
    contentHtml = xhsNote?.desc ? `<p>${escapeHtml(description).replace(/\n/g, '<br>')}</p>` : clonedBody?.outerHTML || `<p>${escapeHtml(description).replace(/\n/g, '<br>')}</p>`;
  }
  if (bili) {
    const description = clean(document.querySelector('.desc-info-text, .video-desc-container, #v_desc')?.innerText);
    if (description && !content.includes(description)) content = `${content}\n\n## 视频简介\n\n${description}`;
  }

  const transcriptSelectors = [
    'ytd-transcript-segment-renderer',
    '[data-testid="transcript"]',
    '[data-testid*="transcript-segment"]',
    '.bpx-player-subtitle-panel-text',
    '.video-transcript',
    '.transcript-segment'
  ];
  const transcript = clean(transcriptSelectors
    .flatMap(selector => [...document.querySelectorAll(selector)])
    .filter(node => node.getBoundingClientRect().width > 0)
    .map(node => node.innerText)
    .join('\n'))
    .slice(0, 100000);
  if (transcript.length >= 80 && !content.includes(transcript.slice(0, 200))) {
    content = `${content}\n\n## 页面中已展开的字幕或文稿\n\n${transcript}`;
  }
  if (!xhs && !x && content.length < 80) content = clean(root.innerText || document.body.innerText || '').slice(0, 180000);
  if (coreState?.description) {
    content = clean(coreState.description).slice(0, 100000);
    contentHtml = `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;
  }

  const selection = window.getSelection();
  const selectedText = clean(selection?.toString());
  let selectionContext = '';
  if (selectedText) {
    const ancestor = selection?.rangeCount ? selection.getRangeAt(0).commonAncestorContainer : null;
    const element = ancestor?.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor?.parentElement;
    selectionContext = clean(element?.closest('p,li,blockquote,section,article,div')?.innerText || '').slice(0, 1800);
  }

  const imageNodes = [...root.querySelectorAll('img')];
  if (xhs && !xhsNote?.images?.length) imageNodes.push(...document.querySelectorAll('#noteContainer .swiper-slide img, #noteContainer .swiper-wrapper img'));
  const images = [];
  const seen = new Set();
  const addImage = image => {
    const url = image.url || imageUrl(image);
    const width = image.width || image.naturalWidth || 0;
    const height = image.height || image.naturalHeight || 0;
    const alt = clean(image.alt || image.getAttribute?.('alt') || image.closest?.('figure')?.querySelector('figcaption')?.textContent).slice(0, 240);
    const className = image.className || '';
    const key = imageKey(url);
    const isCurrentPageUrl = (() => { try { const candidate = new URL(url); return candidate.origin === currentUrl.origin && candidate.pathname === currentUrl.pathname; } catch { return false; } })();
    if (!url || isCurrentPageUrl || seen.has(key) || /avatar|emoji|icon|logo|profile/i.test(`${url} ${className}`) || (!image.url && width && height && (width < 160 || height < 100))) return;
    seen.add(key);
    images.push({url, alt, width, height});
  };
  xhsGallerySnapshot.images.forEach(addImage);
  (coreState?.images || []).forEach(addImage);
  for (const image of imageNodes) {
    if ((xhs && xhsNote?.images?.length) || coreState?.images?.length) break;
    if (image.closest?.('aside,nav,footer,.recommend,.recommendation,.comments,.comment-list,[data-e2e*="comment"]')) continue;
    if (x && !/pbs\.twimg\.com\/media\//i.test(imageUrl(image))) continue;
    addImage(image);
    if (images.length >= 30) break;
  }
  document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(node => {
    const url = absolute(node.content);
    const key = imageKey(url);
    const isXDefault = x && /(^|\.)abs\.twimg\.com$/i.test((() => { try { return new URL(url).hostname; } catch { return ''; } })());
    if (url && !x && !isXDefault && !(xhs && xhsNote?.images?.length) && !coreState?.images?.length && !seen.has(key) && images.length < 30) {
      seen.add(key);
      images.push({url, alt: clean(meta('og:title') || document.title), width: 0, height: 0});
    }
  });

  const videos = [];
  const seenVideos = new Set();
  const addVideo = (value, type = '', poster = '', origin = 'page') => {
    const raw = String(value || '').trim();
    const url = /^(blob:)/i.test(raw) ? raw : absolute(raw);
    if (!url || seenVideos.has(url)) return;
    seenVideos.add(url);
    const lower = url.toLowerCase();
    const kind = /^blob:/i.test(url) ? 'blob' : /\.m3u8(?:$|\?)/i.test(lower) || /mpegurl/i.test(type) ? 'stream_manifest' : /\.(?:mp4|webm|mov|m4v)(?:$|\?)/i.test(lower) || /^video\//i.test(type) ? 'direct_file' : 'embed_or_unknown';
    videos.push({url, type, kind, poster: absolute(poster), origin});
  };
  const videoScope = xhs ? document.querySelector('#noteContainer') || root : x ? root : douyin ? root.closest('[data-e2e="detail-video"]') || root.parentElement || root : tiktok ? document.querySelector('[data-e2e="browse-video"]') || root : bili || youtube ? document.querySelector('#bilibili-player, .bpx-player-container, #movie_player') || root : root;
  const primaryVideoElements = [...videoScope.querySelectorAll('video')];
  if (videoScope.tagName?.toLowerCase() === 'video') primaryVideoElements.unshift(videoScope);
  primaryVideoElements.forEach(video => {
    if (video.closest('aside,nav,footer,.recommend,.recommendation,.comments,.comment-list,[data-e2e*="comment"]')) return;
    if (x && video.poster && !/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\//i.test(video.poster)) return;
    addVideo(video.currentSrc || video.src, video.getAttribute('type') || '', video.poster, 'video_element');
    video.querySelectorAll('source').forEach(source => addVideo(source.src, source.type, video.poster, 'source_element'));
    const captured = videos.find(item => item.url === (video.currentSrc || video.src));
    if (captured) {
      captured.currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      captured.duration = Number.isFinite(video.duration) ? video.duration : null;
    }
  });
  if (!x) {
    document.querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]').forEach(node => addVideo(node.content, meta('og:video:type'), meta('og:image'), 'open_graph'));
    addVideo(jsonLd.contentUrl, jsonLd.encodingFormat || '', jsonLd.thumbnailUrl || meta('og:image'), 'json_ld');
  }
  xhsGallerySnapshot.videos.forEach(video => addVideo(video.url, video.type, video.poster, 'xiaohongshu_gallery'));
  (coreState?.videos || []).forEach(video => addVideo(video.url, video.type, video.poster, 'target_page_state'));
  if (coreState?.videos?.length || xhsNote?.videos?.length) {
    for (let index = videos.length - 1; index >= 0; index--) {
      const expectedOrigin = coreState?.videos?.length ? 'target_page_state' : 'xiaohongshu_gallery';
      if (videos[index].origin !== expectedOrigin) videos.splice(index, 1);
    }
  }
  if (xhs && xhsGallerySnapshot.videos.length) {
    for (let index = videos.length - 1; index >= 0; index--) {
      if (videos[index].kind === 'blob') videos.splice(index, 1);
    }
  }
  if (x && !videos.some(video => video.kind === 'direct_file')) {
    const candidates = [];
    const targetMediaIds = new Set([
      ...videos.map(video => video.poster),
      ...[...root.querySelectorAll('img')].map(image => imageUrl(image))
    ].map(url => String(url || '').match(/\/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\/(\d+)/i)?.[1]).filter(Boolean));
    const addCandidate = raw => {
      const decoded = String(raw || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&').replace(/\\+$/g, '');
      const url = absolute(decoded);
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== 'video.twimg.com' || !/\/(?:amplify_video|ext_tw_video|tweet_video)\//i.test(parsed.pathname) || !/\.(?:mp4|m3u8)(?:$|\?)/i.test(url)) return;
        const resolution = parsed.pathname.match(/\/(\d{2,4})x(\d{2,4})\//i);
        if (/(?:^|\/)init(?:[-_.]|$)/i.test(parsed.pathname) || /\/vid\/avc1\/0\/0\//i.test(parsed.pathname)) return;
        const score = /\.mp4(?:$|\?)/i.test(url) ? 1000000 + (resolution ? Number(resolution[1]) * Number(resolution[2]) : 1) : 1;
        const mediaId = parsed.pathname.match(/\/(?:amplify_video|ext_tw_video)\/(\d+)/i)?.[1] || parsed.pathname;
        if (targetMediaIds.size && !targetMediaIds.has(mediaId)) return;
        candidates.push({url, score, mediaId});
      } catch {}
    };
    try {
      performance.getEntriesByType('resource').map(entry => entry.name).forEach(addCandidate);
    } catch {}
    const xSourceTexts = [...document.querySelectorAll('script')].map(script => String(script.textContent || ''));
    xSourceTexts.forEach(text => {
      if (!text.includes(sourceIdentity.sourceId)) return;
      (text.match(/https?:[^"'\s]{1,2400}?\.(?:mp4|m3u8)(?:[^"'\s]{0,800})?/gi) || []).forEach(addCandidate);
    });
    const bestByMedia = new Map();
    candidates.forEach(candidate => {
      const previous = bestByMedia.get(candidate.mediaId);
      if (!previous || candidate.score > previous.score) bestByMedia.set(candidate.mediaId, candidate);
    });
    if (targetMediaIds.size || bestByMedia.size === 1) {
      [...bestByMedia.values()].forEach(candidate => addVideo(candidate.url, '', videos[0]?.poster || '', 'x_status_media'));
    }
    const resolvedMediaIds = new Set([...bestByMedia.keys()]);
    for (let index = videos.length - 1; index >= 0; index--) {
      const posterMediaId = String(videos[index].poster || '').match(/\/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\/(\d+)/i)?.[1];
      if (videos[index].kind === 'blob' && posterMediaId && resolvedMediaIds.has(posterMediaId)) videos.splice(index, 1);
    }
    for (const mediaId of targetMediaIds) {
      if (videos.some(video => video.mediaId === mediaId || String(video.poster).includes(`/${mediaId}/`))) continue;
      const poster = [...root.querySelectorAll('img')].map(image => imageUrl(image)).find(url => url.includes(`/${mediaId}/`)) || '';
      videos.push({url: '', kind: 'unresolved', poster, mediaId, origin: 'x_player_poster'});
    }
  }
  if (!videos.length && jsonLd.embedUrl && !x) addVideo(jsonLd.embedUrl, '', jsonLd.thumbnailUrl || meta('og:image'), 'json_ld_embed');

  const firstVisible = selectors => selectors
    .flatMap(selector => [...document.querySelectorAll(selector)])
    .find(node => node && (node.getBoundingClientRect().width > 0 || node.getBoundingClientRect().height > 0));
  const authorSelectors = xhs
    ? ['.author-wrapper a[href*="/user/profile/"]', '.author-container a[href*="/user/profile/"]', '#noteContainer a[href*="/user/profile/"]']
    : x
      ? [`article a[href="/${currentUrl.pathname.split('/').filter(Boolean)[0] || ''}"]`, 'article [data-testid="User-Name"] a']
      : douyin
        ? ['a[href*="/user/"][data-e2e*="author"]', 'a[href*="/user/"]']
        : tiktok
          ? ['a[data-e2e="browse-user-avatar"]', 'a[data-e2e="browse-username"]', 'a[href^="/@"]']
          : bili
            ? ['a.up-name', '.up-info-container a[href*="space.bilibili.com"]', 'a[href*="space.bilibili.com"]']
            : wechat
              ? ['#js_name', '.rich_media_meta_nickname']
              : ['[itemprop="author"] a', 'a[rel="author"]', '.author-name a', '.username a'];
  const authorNode = x
    ? root.querySelector('[data-testid="User-Name"] a[href]') || firstVisible(authorSelectors)
    : firstVisible(authorSelectors);
  const authorValue = jsonLd.author;
  const author = clean(
    meta('article:author') ||
    authorNode?.textContent ||
    (Array.isArray(authorValue) ? authorValue.map(item => item?.name).filter(Boolean).join(', ') : authorValue?.name || authorValue) ||
    document.querySelector('[itemprop="author"], .author-name, .username, .up-name, #js_name')?.textContent
  ).slice(0, 180);
  let authorUrl = absolute(authorNode?.getAttribute?.('href') || (Array.isArray(authorValue) ? authorValue[0]?.url : authorValue?.url) || '');
  if (x && !authorUrl) {
    const handle = currentUrl.pathname.split('/').filter(Boolean)[0];
    if (handle && handle !== 'i') authorUrl = `https://x.com/${handle}`;
  }
  const authorId = (() => {
    if (!authorUrl) return '';
    try {
      const url = new URL(authorUrl);
      return url.pathname.match(/\/(?:user\/profile\/|user\/|space\/)?(@?[^/?#]+)/i)?.[1] || '';
    } catch { return ''; }
  })();

  const parseMetric = value => {
    const raw = clean(value).replace(/,/g, '');
    const match = raw.match(/(\d+(?:\.\d+)?)\s*(万|w|k|m|亿)?/i);
    if (!match) return {raw, value: null};
    const multipliers = {万: 10000, w: 10000, k: 1000, m: 1000000, 亿: 100000000};
    return {raw, value: Math.round(Number(match[1]) * (multipliers[String(match[2] || '').toLowerCase()] || 1))};
  };
  const metricText = selectors => {
    const node = x ? selectors.map(selector => root.querySelector(selector.replace(/^article\s+/, ''))).find(Boolean) : firstVisible(selectors);
    return clean(node?.getAttribute?.('aria-label') || node?.textContent || '');
  };
  const metricSelectors = xhs ? {
    likes: ['.engage-bar .like-wrapper', '.like-wrapper', '[class*="like-wrapper"]'],
    favorites: ['.engage-bar .collect-wrapper', '.collect-wrapper', '[class*="collect-wrapper"]'],
    comments: ['.engage-bar .chat-wrapper', '.chat-wrapper', '[class*="chat-wrapper"]']
  } : x ? {
    replies: ['article [data-testid="reply"]'], reposts: ['article [data-testid="retweet"]'], likes: ['article [data-testid="like"]', 'article [data-testid="unlike"]'], bookmarks: ['article [data-testid="bookmark"]'], views: ['article a[href$="/analytics"]']
  } : douyin ? {
    likes: ['[data-e2e="like-count"]'], comments: ['[data-e2e="comment-count"]'], favorites: ['[data-e2e="favorite-count"]'], shares: ['[data-e2e="share-count"]']
  } : tiktok ? {
    likes: ['[data-e2e="like-count"]'], comments: ['[data-e2e="comment-count"]'], favorites: ['[data-e2e="undefined-count"]', '[data-e2e="favorite-count"]'], shares: ['[data-e2e="share-count"]']
  } : bili ? {
    views: ['.view.item', '.video-data .view'], likes: ['.video-like-info', '.ops .like'], favorites: ['.video-fav-info', '.ops .collect'], comments: ['.reply-header .nav-title-text'], shares: ['.video-share-info', '.ops .share']
  } : {};
  const socialMetrics = {};
  Object.entries(metricSelectors).forEach(([name, selectors]) => {
    const raw = metricText(selectors);
    if (raw) socialMetrics[name] = parseMetric(raw);
  });

  const commentSelectors = xhs
    ? ['.comments-container .parent-comment', '.comments-container .comment-item', '#noteContainer [class*="comment-item"]']
    : [];
  const commentNodes = commentSelectors.flatMap(selector => [...document.querySelectorAll(selector)]);
  const seenComments = new Set();
  const comments = [];
  const authorFollowups = [];
  for (const node of commentNodes) {
    const textNode = node.querySelector('.content, .comment-content, [class*="content"]');
    const text = clean(textNode?.innerText || node.innerText).slice(0, 2000);
    if (!text || text.length < 2 || seenComments.has(text)) continue;
    seenComments.add(text);
    const commentAuthorNode = node.querySelector('a[href*="/user/profile/"], .name, .author, [class*="name"]');
    const commentAuthorUrl = absolute(commentAuthorNode?.getAttribute?.('href') || '');
    const commentAuthorId = (() => { try { return new URL(commentAuthorUrl).pathname.match(/\/user\/profile\/([^/?#]+)/i)?.[1] || ''; } catch { return ''; } })();
    const likesRaw = clean(node.querySelector('.like-count, [class*="like"]')?.innerText || '');
    const entry = {
      text,
      author: clean(commentAuthorNode?.innerText).slice(0, 120),
      authorUrl: commentAuthorUrl,
      likes: likesRaw ? parseMetric(likesRaw) : null,
      captureOrder: comments.length + 1,
      source: 'visible_dom_order',
      isAuthor: Boolean(authorId && commentAuthorId === authorId)
    };
    if (entry.isAuthor) authorFollowups.push({...entry, url: commentAuthorUrl, source: 'author_comment'});
    if (comments.length < 10) comments.push(entry);
  }
  if (x && authorId) {
    [...document.querySelectorAll('article[data-testid="tweet"]')].forEach(article => {
      if (article === root || article.contains(root) || root.contains(article)) return;
      const profileLinks = [...article.querySelectorAll('[data-testid="User-Name"] a[href], a[href]')]
        .map(link => absolute(link.getAttribute('href')))
        .filter(Boolean);
      const sameAuthor = profileLinks.some(value => {
        try { return new URL(value).pathname.replace(/\/$/, '').toLowerCase() === `/${authorId}`.toLowerCase(); } catch { return false; }
      });
      if (!sameAuthor) return;
      const statusAnchor = [...article.querySelectorAll('a[href*="/status/"]')].find(link => /\/status\/\d+/.test(link.getAttribute('href') || ''));
      const replyUrl = absolute(statusAnchor?.getAttribute('href') || '');
      const replyId = (() => { try { return new URL(replyUrl).pathname.match(/\/status\/(\d+)/)?.[1] || ''; } catch { return ''; } })();
      if (!replyId || replyId === sourceIdentity.sourceId || authorFollowups.some(item => item.sourceId === replyId)) return;
      const text = clean(article.querySelector('[data-testid="tweetText"]')?.innerText || '').slice(0, 10000);
      const media = [...article.querySelectorAll('img')].map(image => imageUrl(image)).filter(url => /pbs\.twimg\.com\/media\//i.test(url));
      const videoPosters = [...article.querySelectorAll('video[poster]')].map(video => absolute(video.poster)).filter(Boolean);
      if (!text && !media.length && !videoPosters.length) return;
      authorFollowups.push({text, url: replyUrl, sourceId: replyId, source: 'author_thread_reply', media: [...new Set(media)], videoPosters: [...new Set(videoPosters)]});
    });
  }
  const published = meta('article:published_time') || jsonLd.datePublished || document.querySelector('time[datetime]')?.getAttribute('datetime') || '';
  const title = clean(coreState?.title || xhsNote?.title || (xhs && document.querySelector('#detail-title, .note-content .title')?.textContent) || meta('og:title') || jsonLd.headline || document.title).slice(0, 300);
  const canonicalCandidate = absolute(document.querySelector('link[rel="canonical"]')?.href || jsonLd.url || '');
  const genericCollectionPaths = new Set(['/', '/explore', '/home', '/search', '/feed', '/foryou']);
  const candidateUrl = (() => {
    if (!canonicalCandidate) return '';
    try {
      const url = new URL(canonicalCandidate);
      return genericCollectionPaths.has(url.pathname.replace(/\/$/, '') || '/') ? '' : url.href;
    } catch { return ''; }
  })();
  const canonicalUrl = sourceIdentity.sourceUrl || candidateUrl || location.href;
  const accessUrl = (() => {
    if (!xhs || !sourceIdentity.sourceId || !currentUrl.searchParams.get('xsec_token')) return canonicalUrl;
    const target = new URL(canonicalUrl);
    for (const key of ['xsec_token', 'xsec_source']) if (currentUrl.searchParams.has(key)) target.searchParams.set(key, currentUrl.searchParams.get(key));
    return target.href;
  })();
  const description = clean(meta('og:description') || meta('description', 'name') || jsonLd.description).slice(0, 1200);
  const ogType = meta('og:type');
  const hasPrimaryVideo = xhs
    ? videos.some(video => ['xiaohongshu_gallery', 'video_element', 'source_element'].includes(video.origin) && video.kind !== 'embed_or_unknown')
    : videos.length > 0;
  const isVideo = /video/i.test(ogType) || hasPrimaryVideo || bili || youtube || douyin || tiktok;
  const isArticle = wechat || /article/i.test(ogType) || Boolean(document.querySelector('article'));
  const contentType = isVideo ? 'video' : xhs || images.length >= 3 ? 'image_post' : isArticle ? 'article' : 'social_post';
  const capturedAt = new Date().toISOString();
  const hashInput = `${canonicalUrl}\n${content.slice(0, 10000)}\n${selectedText}`;
  let hash = 2166136261;
  for (let index = 0; index < hashInput.length; index++) {
    hash ^= hashInput.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const contentHash = (hash >>> 0).toString(16).padStart(8, '0');
  const dedupeKey = sourceIdentity.sourceId
    ? `${platformId}:${sourceIdentity.sourceId}`
    : candidateUrl
      ? `url:${canonicalUrl}`
      : `hash:${contentHash}`;
  const warnings = [];
  const minimumExpectedLength = xhs || contentType === 'social_post' ? 50 : 300;
  if (content.length < minimumExpectedLength) warnings.push('extracted_content_is_short');
  if (xhs && !xhsBodyFound) warnings.push('xiaohongshu_note_body_not_found');
  if (x && !preferredRoot) warnings.push('x_target_post_not_found');
  if (!title) warnings.push('missing_title');
  if (!canonicalUrl) warnings.push('missing_canonical_url');
  const foundGalleryMedia = images.length + videos.filter(video => video.origin === 'xiaohongshu_gallery' || video.origin === 'video_element' || video.origin === 'source_element').length;
  if (xhsGallerySnapshot.expected && foundGalleryMedia < xhsGallerySnapshot.expected) warnings.push(`xiaohongshu_gallery_incomplete:${foundGalleryMedia}/${xhsGallerySnapshot.expected}`);

  return {
    schema: 'kumo-clip-v1',
    extractorVersion: '0.8.1',
    id: `${capturedAt.slice(0, 10)}-${contentHash}`,
    title: title || '未命名网页',
    author,
    authorUrl,
    authorId,
    published,
    url: canonicalUrl || location.href,
    accessUrl,
    capturedUrl: location.href,
    platform,
    platformId,
    platformGuide: `platforms/${platformId}.md`,
    sourceId: sourceIdentity.sourceId,
    dedupeKey,
    dedupeSafeUrl: Boolean(sourceIdentity.dedupeSafe || candidateUrl),
    capturedAt,
    contentType,
    description,
    content,
    contentHtml,
    selection: selectedText ? {text: selectedText.slice(0, 30000), context: selectionContext} : null,
    images,
    videos,
    socialMetrics,
    comments,
    authorFollowups,
    socialCapturedAt: capturedAt,
    stats: {characters: content.length, images: images.length, videos: videos.length, comments: comments.length, expectedGalleryMedia: xhsGallerySnapshot.expected || null, foundGalleryMedia: xhsGallerySnapshot.expected ? foundGalleryMedia : null},
    contentHash,
    warnings
  };
}
