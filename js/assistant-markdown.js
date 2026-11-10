/* AI 비서 답변용 가벼운 마크다운 변환.
 * 원문을 먼저 이스케이프한 뒤 변환하므로, 답변에 든 HTML 태그는 글자로만 보인다.
 * 브라우저: window.AilabMarkdown.render(text) / Node 테스트: require(...).render
 */
(function (root) {
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inline(s) {
    return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function cells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }

  var RE_ROW = /^\s*\|.*\|\s*$/;
  var RE_SEP = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;
  var RE_UL = /^\s*[-*•]\s+/;
  var RE_OL = /^\s*\d+[.)]\s+/;
  var RE_HR = /^\s*(-{3,}|\*{3,})\s*$/;
  var RE_FENCE = /^\s*```/;

  function render(text) {
    var lines = esc(text == null ? '' : text).split('\n');
    var html = '';
    var para = [];
    var i = 0;

    function flush() {
      if (para.length) {
        html += '<p>' + inline(para.join('<br>')) + '</p>';
        para = [];
      }
    }

    function list(tag, re) {
      flush();
      html += '<' + tag + '>';
      while (i < lines.length && re.test(lines[i])) {
        html += '<li>' + inline(lines[i].replace(re, '')) + '</li>';
        i++;
      }
      html += '</' + tag + '>';
    }

    while (i < lines.length) {
      var line = lines[i];

      if (RE_FENCE.test(line)) {
        flush();
        var code = [];
        i++;
        while (i < lines.length && !RE_FENCE.test(lines[i])) { code.push(lines[i]); i++; }
        i++; // 닫는 ```
        html += '<pre><code>' + code.join('\n') + '</code></pre>';
        continue;
      }

      var heading = line.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        flush();
        var level = Math.min(heading[1].length + 2, 6);
        html += '<h' + level + '>' + inline(heading[2]) + '</h' + level + '>';
        i++;
        continue;
      }

      if (RE_ROW.test(line) && i + 1 < lines.length && RE_SEP.test(lines[i + 1])) {
        flush();
        html += '<table><thead><tr>' + cells(line).map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        i += 2;
        while (i < lines.length && RE_ROW.test(lines[i])) {
          html += '<tr>' + cells(lines[i]).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          i++;
        }
        html += '</tbody></table>';
        continue;
      }

      if (RE_HR.test(line)) { flush(); html += '<hr>'; i++; continue; }
      if (RE_UL.test(line)) { list('ul', RE_UL); continue; }
      if (RE_OL.test(line)) { list('ol', RE_OL); continue; }
      if (!line.trim()) { flush(); i++; continue; }

      para.push(line);
      i++;
    }
    flush();
    return html;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { render: render };
  else root.AilabMarkdown = { render: render };
})(typeof window !== 'undefined' ? window : this);
