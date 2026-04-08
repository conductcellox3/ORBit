export function parseMarkdown(text) {
    if (!text) return '';

    // Normalize Windows line endings to simplify Regex anchors
    text = text.replace(/\r\n/g, '\n');

    const codeBlocks = [];
    text = text.replace(/^```(?:\w+)?[ \t]*\n([\s\S]*?)^```[ \t]*/gm, (match, code) => {
        let escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        codeBlocks.push(`<pre><code>${escaped}</code></pre>`);
        return `___CODEBLOCK_${codeBlocks.length - 1}___`;
    });

    const inlineCodes = [];
    text = text.replace(/`([^`\n]+)`/g, (match, code) => {
        let escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        inlineCodes.push(`<code>${escaped}</code>`);
        return `___INLINECODE_${inlineCodes.length - 1}___`;
    });

    // Escape HTML from remaining text
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Inline formatting passes
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/==([^=]+)==/g, '<mark>$1</mark>');

    // Block elements processing line by line
    let lines = text.split('\n');
    let inUl = false;
    let inOl = false;
    let htmlLines = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Ensure we close lists if we change block types
        const closeLists = () => {
            if (inUl) { htmlLines.push('</ul>'); inUl = false; }
            if (inOl) { htmlLines.push('</ol>'); inOl = false; }
        };

        // Code blocks just pass through
        if (line.match(/^___CODEBLOCK_\d+___$/)) {
            closeLists();
            htmlLines.push(line);
            continue;
        }

        // Headings
        let hMatch = line.match(/^(#{1,3})\s+(.*)/);
        if (hMatch) {
            closeLists();
            let level = hMatch[1].length;
            htmlLines.push(`<h${level}>${hMatch[2]}</h${level}>`);
            continue;
        }

        // Unordered lists
        let ulMatch = line.match(/^-\s+(.*)/);
        if (ulMatch) {
            if (inOl) { htmlLines.push('</ol>'); inOl = false; }
            if (!inUl) { htmlLines.push('<ul class="orbit-md-ul">'); inUl = true; }
            htmlLines.push(`<li>${ulMatch[1]}</li>`);
            continue;
        }

        // Ordered lists
        let olMatch = line.match(/^\d+\.\s+(.*)/);
        if (olMatch) {
            if (inUl) { htmlLines.push('</ul>'); inUl = false; }
            if (!inOl) { htmlLines.push('<ol class="orbit-md-ol">'); inOl = true; }
            htmlLines.push(`<li>${olMatch[1]}</li>`);
            continue;
        }

        // Normal line
        closeLists();
        htmlLines.push(line);
    }

    // Close any dangling lists
    if (inUl) htmlLines.push('</ul>');
    if (inOl) htmlLines.push('</ol>');

    // Process line breaks logic cleanly
    // Merge lines using <br> for plain text
    // We don't want <br> between block elements
    let finalHtml = '';
    const blockTags = ['ul', '/ul', 'ol', '/ol', 'h1', 'h2', 'h3', '___CODEBLOCK'];
    
    for (let i = 0; i < htmlLines.length; i++) {
        const ln = htmlLines[i];
        let isBlock = blockTags.some(t => ln.startsWith('<' + t) || ln.startsWith(t));
        
        finalHtml += ln;
        
        if (i < htmlLines.length - 1) {
            let nextLn = htmlLines[i+1];
            let nextIsBlock = blockTags.some(t => nextLn.startsWith('<' + t) || nextLn.startsWith(t));
            
            // Add <br> unless transitioning to or from a block or inside a list (<li>)
            // Actually, if current is a normal text line and next is a normal text line, we definitely want a <br>
            if (!lineIsInsideBlockLikeList(ln, nextLn) && !isFullBlockLine(ln) && !isFullBlockLine(nextLn)) {
                 finalHtml += '<br>';
            } else if (!isFullBlockLine(ln) && isFullBlockLine(nextLn)) {
                 if (ln.trim() !== '') finalHtml += '<br>';
            } else if (isFullBlockLine(ln) && !isFullBlockLine(nextLn) && nextLn.trim() === '') {
                 // Do not insert <br> immediately after a block if next is just empty line
            } else if (ln.trim() === '' && nextLn.trim() === '') {
                 finalHtml += '<br>';
            }
            finalHtml += '\n';
        }
    }

    function isFullBlockLine(line) {
        return blockTags.some(t => line.startsWith('<' + t) || line.startsWith(t));
    }
    
    function lineIsInsideBlockLikeList(line1, line2) {
        return line1.startsWith('<li>') || line1.startsWith('<ul') || line1.startsWith('<ol') || line2.startsWith('<li>') || line2.startsWith('</ul>') || line2.startsWith('</ol>');
    }

    // Clean up empty <br>\n sequences at the very beginning/end of the markdown if any
    finalHtml = finalHtml.trim();
    if (finalHtml.startsWith('<br>\n')) finalHtml = finalHtml.substring(5);

    // Restore inline codes
    finalHtml = finalHtml.replace(/___INLINECODE_(\d+)___/g, (match, idx) => {
        return inlineCodes[parseInt(idx, 10)];
    });

    // Restore code blocks
    finalHtml = finalHtml.replace(/___CODEBLOCK_(\d+)___/g, (match, idx) => {
        return codeBlocks[parseInt(idx, 10)];
    });

    return finalHtml;
}
