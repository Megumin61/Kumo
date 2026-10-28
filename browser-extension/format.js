(function (scope) {
  const safeLine = value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  const yaml = value => JSON.stringify(String(value ?? ''));
  const slug = value => safeLine(value)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/[. ]+$/g, '')
    .slice(0, 64) || 'untitled';
  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function buildMarkdown(clip, note = '', screenshotSaved = false) {
    const metricLabels = {likes: '点赞', favorites: '收藏', bookmarks: '书签', comments: '评论', replies: '回复', reposts: '转发', shares: '分享', views: '浏览'};
    const metricItems = Object.entries(clip.socialMetrics || {}).map(([name, metric]) => {
      const shown = metric?.raw || (Number.isFinite(metric?.value) ? String(metric.value) : '');
      return shown ? `${metricLabels[name] || name} ${shown}` : '';
    }).filter(Boolean);
    const authorLabel = safeLine(clip.author) || '未识别作者';
    const authorDisplay = clip.authorUrl ? `[${authorLabel}](${clip.authorUrl})` : authorLabel;
    const partial = (clip.warnings || []).some(warning => /incomplete|not_fully_downloaded|missing_|not_found|discovery_failed|media_download_pending/i.test(warning));
    const completeness = partial ? 'partial' : 'page_accessible_complete';
    const lines = [
      '---',
      'schema: kumo-clip-v1',
      `extractor_version: ${yaml(clip.extractorVersion || '')}`,
      `id: ${yaml(clip.id)}`,
      'status: inbox',
      `title: ${yaml(clip.title)}`,
      `source_url: ${yaml(clip.url)}`,
      `captured_url: ${yaml(clip.capturedUrl)}`,
      `access_url: ${yaml(clip.accessUrl || clip.url)}`,
      `platform: ${yaml(clip.platform)}`,
      `platform_id: ${yaml(clip.platformId || 'generic')}`,
      `platform_guide: ${yaml(clip.platformGuide || 'platforms/generic.md')}`,
      `source_id: ${yaml(clip.sourceId || '')}`,
      `dedupe_key: ${yaml(clip.dedupeKey || '')}`,
      `content_type: ${yaml(clip.contentType || 'web_page')}`,
      `target_agent: ${yaml(clip.targetAgent || '')}`,
      `library_path: ${yaml(clip.libraryPath || '')}`,
      `author: ${yaml(clip.author)}`,
      `author_url: ${yaml(clip.authorUrl || '')}`,
      `author_id: ${yaml(clip.authorId || '')}`,
      `published_at: ${yaml(clip.published)}`,
      `captured_at: ${yaml(clip.capturedAt)}`,
      `content_hash: ${yaml(clip.contentHash)}`,
      `capture_mode: ${yaml(clip.selection ? 'selection_with_context' : 'readable_page')}`,
      `capture_completeness: ${completeness}`,
      `screenshot: ${screenshotSaved ? 'viewport.png' : 'null'}`,
      `downloaded_images: ${clip.stats?.downloadedImages || 0}`,
      `downloaded_videos: ${clip.stats?.downloadedVideos || 0}`,
      '---', '',
      `# ${safeLine(clip.title)}`, '',
      `> ${safeLine(clip.platform) || '网页'} · ${safeLine(clip.contentType || 'web_page')} · 作者 ${authorDisplay}${clip.published ? ` · 发布于 ${safeLine(clip.published)}` : ''} · [打开原文](${clip.accessUrl || clip.url})`,
      '',
      '## 内容清单', '',
      `正文 ${clip.stats?.characters || 0} 字 · 图片 ${clip.stats?.images || 0} 张（本地 ${clip.stats?.downloadedImages || 0}） · 视频 ${clip.stats?.videos || 0} 个（本地 ${clip.stats?.downloadedVideos || 0}） · 评论快照 ${(clip.comments || []).length} 条 · [平台结构说明](../../${clip.platformGuide || 'platforms/generic.md'})`, ''
    ].filter((line, index, array) => line !== '' || array[index - 1] !== '');

    if (String(note).length) lines.push('## 笔记（用户原文）', '', '__KUMO_VERBATIM_NOTE__', '');
    if (clip.userTags?.length) lines.push('## 用户标签', '', clip.userTags.map(tag => safeLine(tag.label)).join(' · '), '');
    if (clip.videoContext || clip.videoIntent) {
      const context = clip.videoContext || {};
      lines.push('## 我希望 AI 参考的视频线索', '');
      if (clip.videoIntent) lines.push(`用途：${safeLine(clip.videoIntent)}。`, '');
      if (Number.isFinite(context.positionSeconds)) lines.push(`剪藏时观看位置：${context.positionSeconds.toFixed(1)} 秒${Number.isFinite(context.durationSeconds) ? ` / 全长 ${context.durationSeconds.toFixed(1)} 秒` : ''}。这不是已观看时长，也不表示用户认可视频全部观点。`, '');
      if (context.frameFile) lines.push(`![剪藏时的视频画面](${context.frameFile})`, '');
      else if (context.frameError) lines.push(`独立关键帧未能提取：${safeLine(context.frameError)}${screenshotSaved ? '；可参考 viewport.png 中的当前画面' : ''}。`, '');
      lines.push('AI 应结合用户留下的理由和选区理解用途；视频文件存在不代表已提取声音、字幕或理解整段内容。', '');
    }

    if (clip.selection?.text) {
      lines.push('## 我标出的原文', '', clip.selection.text.split('\n').map(line => `> ${line}`).join('\n'), '');
      if (clip.selection.context && clip.selection.context !== clip.selection.text) {
        lines.push('选区上下文：', '', clip.selection.context, '');
      }
    }

    lines.push('## 正文', '', clip.content || '未能提取正文；请查看原始页面。', '');
    if (clip.authorFollowups?.length) {
      lines.push('## 作者在评论区或帖子串中的补充', '', '> 以下内容由原作者账号在当前评论区或帖子串中发布，和普通评论分开保存。', '');
      clip.authorFollowups.forEach((item, index) => {
        lines.push(`### 补充 ${index + 1}`, '', item.text || '该补充只包含媒体。', '');
        if (item.url) lines.push(`补充来源：[打开对应内容](${item.url})`, '');
        (item.media || []).forEach((url, mediaIndex) => lines.push(`![作者补充图片 ${mediaIndex + 1}](${url})`, ''));
        (item.videoPosters || []).forEach((url, mediaIndex) => lines.push(`作者补充视频封面 ${mediaIndex + 1}：${url}`, ''));
      });
    }
    if (metricItems.length) {
      lines.push('## 互动数据快照', '', `${metricItems.join(' · ')}（采集于 ${safeLine(clip.socialCapturedAt || clip.capturedAt)}；数值会随时间变化）`, '');
    }
    if (clip.comments?.length) {
      lines.push('## 讨论快照（辅助证据）', '', '> 以下是剪藏时页面已加载的评论，优先按可识别的点赞数排序；不代表全站最高赞、事实或普遍共识。', '');
      clip.comments.forEach((comment, index) => {
        const commentAuthor = safeLine(comment.author) || '匿名用户';
        const author = comment.authorUrl ? `[${commentAuthor}](${comment.authorUrl})` : commentAuthor;
        const likes = comment.likes?.raw ? ` · ${comment.likes.raw} 赞` : '';
        lines.push(`${index + 1}. ${author}${likes}：${safeLine(comment.text)}`, '');
      });
    }
    if (clip.images?.length) {
      lines.push('## 图片', '');
      clip.images.forEach((image, index) => {
        const label = safeLine(image.alt) || `图片 ${index + 1}`;
        lines.push(`![${label.replace(/\]/g, '\\]')}](${image.localFile || image.url})`, '');
        if (image.localFile && image.url) lines.push(`原始图片地址：${image.url}`, '');
      });
    }
    if (clip.videos?.length) {
      lines.push('## 视频', '');
      clip.videos.forEach((video, index) => {
        const label = `视频 ${index + 1}`;
        if (video.localFile) lines.push(`[${label}（本地文件）](${video.localFile})`, '');
        else lines.push(`${label}：未保存为本地文件（${safeLine(video.downloadError || video.kind || '未知原因')}）`, '');
        if (video.url && !String(video.url).startsWith('blob:')) lines.push(`播放来源：${video.url}`, '');
        if (video.poster) lines.push(`视频封面：${video.poster}`, '');
      });
    }
    if (screenshotSaved) lines.push('## 剪藏时的当前视口', '', '![剪藏时屏幕上可见的页面](viewport.png)', '');
    lines.push(
      '## 采集说明', '',
      `完整性：${partial ? '部分保存；以下提示说明了缺失或失败项' : '已保存当前页面能够访问和识别的核心内容；平台未向页面暴露的隐藏内容仍可能不存在于本地包中'}。`,
      `正文字符数：${clip.stats?.characters || 0}；主要图片 ${clip.stats?.images || 0} 张（本地 ${clip.stats?.downloadedImages || 0}）；视频 ${clip.stats?.videos || 0} 个（本地 ${clip.stats?.downloadedVideos || 0}）。`,
      clip.warnings?.length ? `质量提示：${clip.warnings.join(', ')}。` : '未发现明显的提取质量问题。',
      `原帖回溯：[${safeLine(clip.url)}](${clip.accessUrl || clip.url})`,
      '',
      '这是来源层文件，由浏览器当时已加载的页面生成。网页内容可能变化或消失；AI 整理时应保留本文件并把派生判断写到其他文件。', ''
    );
    const markdown = lines.join('\n').replace(/\n{3,}/g, '\n\n');
    // Replace only our note slot, never normalize whitespace in the user's note.
    const marker = '## 笔记（用户原文）\n\n';
    const section = markdown.indexOf(marker + '__KUMO_VERBATIM_NOTE__');
    const slot = section < 0 ? -1 : section + marker.length;
    return String(note).length && slot >= 0 ? markdown.slice(0, slot) + String(note) + markdown.slice(slot + '__KUMO_VERBATIM_NOTE__'.length) : markdown;
  }

  function buildMetadata(clip, note = '', screenshotSaved = false) {
    return JSON.stringify({
      ...clip,
      content: undefined,
      contentHtml: undefined,
      excerpt: String(clip.content || '').replace(/\s+/g,' ').trim().slice(0,240),
      userNote: String(note ?? ''),
      files: {
        markdown: 'source.md',
        readableHtml: 'readable.html',
        screenshot: screenshotSaved ? 'viewport.png' : null,
        images: (clip.images || []).filter(image => image.localFile).map(image => image.localFile),
        videos: (clip.videos || []).filter(video => video.localFile).map(video => video.localFile),
        frames: clip.videoContext?.frameFile ? [clip.videoContext.frameFile] : []
      }
    }, null, 2);
  }

  function buildReadableHtml(clip) {
    const author = escapeHtml(clip.author || '未识别作者');
    const authorHtml = clip.authorUrl ? `<a href="${escapeHtml(clip.authorUrl)}">${author}</a>` : author;
    const metricLabels = {likes: '点赞', favorites: '收藏', bookmarks: '书签', comments: '评论', replies: '回复', reposts: '转发', shares: '分享', views: '浏览'};
    const metrics = Object.entries(clip.socialMetrics || {}).map(([name, metric]) => `${metricLabels[name] || name} ${escapeHtml(metric?.raw || metric?.value || '')}`).filter(value => !value.endsWith(' ')).join(' · ');
    const comments = (clip.comments || []).map(comment => `<li><strong>${escapeHtml(comment.author || '匿名用户')}</strong>${comment.likes?.raw ? ` · ${escapeHtml(comment.likes.raw)} 赞` : ''}：${escapeHtml(comment.text)}</li>`).join('');
    const followups = (clip.authorFollowups || []).map((item, index) => `<section><h3>补充 ${index + 1}</h3><p>${escapeHtml(item.text || '该补充只包含媒体。')}</p>${item.url ? `<p><a href="${escapeHtml(item.url)}">打开对应内容</a></p>` : ''}${(item.media || []).map(url => `<img src="${escapeHtml(url)}" alt="作者补充图片">`).join('')}${(item.videoPosters || []).map(url => `<p>作者补充视频封面：<a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`).join('')}</section>`).join('');
    return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file: http: https: data:; media-src 'self' file: http: https: blob:; style-src 'unsafe-inline'">
<title>${escapeHtml(clip.title)}</title><style>body{max-width:760px;margin:40px auto;padding:0 20px;font:17px/1.75 system-ui,sans-serif;color:#202124}img{max-width:100%;height:auto}a{color:#175c46}pre{white-space:pre-wrap;background:#f5f5f2;padding:12px;border-radius:8px}blockquote{border-left:3px solid #9ab8aa;margin-left:0;padding-left:16px;color:#526059}</style></head>
<body><p><a href="${escapeHtml(clip.accessUrl || clip.url)}">打开原始页面</a></p><h1>${escapeHtml(clip.title)}</h1><p>${escapeHtml(clip.platform)} · 作者 ${authorHtml}${clip.published ? ` · ${escapeHtml(clip.published)}` : ''}</p>${clip.contentHtml || ''}${followups ? `<h2>作者在评论区或帖子串中的补充</h2>${followups}` : ''}${metrics ? `<h2>互动数据快照</h2><p>${metrics}</p>` : ''}${comments ? `<h2>讨论快照（辅助证据）</h2><p>从剪藏时已加载的评论中优先保留可识别的高赞评论，不代表全站最高赞、事实或普遍共识。</p><ol>${comments}</ol>` : ''}${clip.images?.length ? `<h2>帖子图片</h2>${clip.images.map((image, index) => `<figure><img src="${escapeHtml(image.localFile || image.url)}" alt="${escapeHtml(image.alt || `图片 ${index + 1}`)}">${image.alt ? `<figcaption>${escapeHtml(image.alt)}</figcaption>` : ''}</figure>`).join('')}` : ''}${clip.videos?.length ? `<h2>帖子视频</h2>${clip.videos.map((video, index) => video.localFile ? `<video controls preload="metadata" src="${escapeHtml(video.localFile)}"${video.poster ? ` poster="${escapeHtml(video.poster)}"` : ''}>视频 ${index + 1}</video>` : `<p>视频 ${index + 1} 未保存为本地文件。${video.url && !String(video.url).startsWith('blob:') ? `<a href="${escapeHtml(video.url)}">打开播放来源</a>` : ''}</p>`).join('')}` : ''}<h2>回溯</h2><p><a href="${escapeHtml(clip.accessUrl || clip.url)}">打开原帖</a></p></body></html>`;
  }

  const api = {buildMarkdown, buildMetadata, buildReadableHtml, slug};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.KumoFormat = api;
})(globalThis);
