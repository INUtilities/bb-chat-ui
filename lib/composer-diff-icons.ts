function iconRoot(document:Document):SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

export function commitIcon(document:Document):SVGSVGElement {
  const svg = iconRoot(document);
  const lines = document.createElementNS(svg.namespaceURI, "path");
  lines.setAttribute("d", "M3 12h5m8 0h5");
  const circle = document.createElementNS(svg.namespaceURI, "circle");
  circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "4");
  svg.append(lines, circle);
  return svg;
}

// Hugeicons free SVGs at c1b280d3964e115dfdefb58241f6d93ca68f7b6d (MIT); source mapping and full notice: THIRD_PARTY_NOTICES.md.
const fileGlyphs:Record<string, readonly (readonly [string, Record<string,string>])[]> = {
  DiffModified: [
    ["path", {"d":"M11.9922 12V11.2M12.9922 12C12.9922 11.4477 12.5445 11 11.9922 11C11.4399 11 10.9922 11.4477 10.9922 12C10.9922 12.5523 11.4399 13 11.9922 13C12.5445 13 12.9922 12.5523 12.9922 12Z"}],
    ["path", {"d":"M2.49219 12C2.49219 7.52166 2.49219 5.28249 3.88343 3.89124C5.27467 2.5 7.51384 2.5 11.9922 2.5C16.4705 2.5 18.7097 2.5 20.1009 3.89124C21.4922 5.28249 21.4922 7.52166 21.4922 12C21.4922 16.4783 21.4922 18.7175 20.1009 20.1088C18.7097 21.5 16.4705 21.5 11.9922 21.5C7.51384 21.5 5.27467 21.5 3.88343 20.1088C2.49219 18.7175 2.49219 16.4783 2.49219 12Z"}],
  ],
  DiffAdded: [
    ["path", {"d":"M2.5 12.0001C2.5 7.52171 2.5 5.28254 3.89124 3.8913C5.28249 2.50005 7.52166 2.50005 12 2.50005C16.4783 2.50005 18.7175 2.50005 20.1088 3.8913C21.5 5.28254 21.5 7.52171 21.5 12.0001C21.5 16.4784 21.5 18.7176 20.1088 20.1088C18.7175 21.5001 16.4783 21.5001 12 21.5001C7.52166 21.5001 5.28249 21.5001 3.89124 20.1088C2.5 18.7176 2.5 16.4784 2.5 12.0001Z"}],
    ["path", {"d":"M12 8.00005V16.0001M16 12.0001L8 12.0001"}],
  ],
  DiffRemoved: [
    ["path", {"d":"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z"}],
    ["path", {"d":"M16 12H8"}],
  ],
  DiffRenamed: [
    ["path", {"d":"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z"}],
    ["path", {"d":"M10 7C10 7 14 10.6824 14 12C14 13.3176 10 17 10 17"}],
  ],
  DiffConflict: [
    ["path", {"d":"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z"}],
    ["path", {"d":"M12 8V12"}],
    ["path", {"d":"M12.125 15.75H12M12.25 15.75C12.25 15.8881 12.1381 16 12 16C11.8619 16 11.75 15.8881 11.75 15.75C11.75 15.6119 11.8619 15.5 12 15.5C12.1381 15.5 12.25 15.6119 12.25 15.75Z"}],
  ],
  Copy: [
    ["path", {"d":"M7.5 14.5C7.5 11.2002 7.5 9.55025 8.52513 8.52513C9.55025 7.5 11.2002 7.5 14.5 7.5C17.7998 7.5 19.4497 7.5 20.4749 8.52513C21.5 9.55025 21.5 11.2002 21.5 14.5C21.5 17.7998 21.5 19.4497 20.4749 20.4749C19.4497 21.5 17.7998 21.5 14.5 21.5C11.2002 21.5 9.55025 21.5 8.52513 20.4749C7.5 19.4497 7.5 17.7998 7.5 14.5Z"}],
    ["path", {"d":"M7.5 16.5C6.10355 16.5 5.40533 16.5 4.84402 16.3036C3.83866 15.9518 3.0482 15.1613 2.69641 14.156C2.5 13.5947 2.5 12.8964 2.5 11.5V9.5C2.5 6.20017 2.5 4.55025 3.52513 3.52513C4.55025 2.5 6.20017 2.5 9.5 2.5H11.5C12.8964 2.5 13.5947 2.5 14.156 2.69641C15.1613 3.0482 15.9518 3.83866 16.3036 4.84402C16.5 5.40533 16.5 6.10355 16.5 7.5"}],
  ],
  CircleQuestion: [
    ["circle", {"cx":"12","cy":"12","r":"10"}],
    ["path", {"d":"M9.5 9.5C9.5 8.11929 10.6193 7 12 7C13.3807 7 14.5 8.11929 14.5 9.5C14.5 10.3569 14.0689 11.1131 13.4117 11.5636C12.7283 12.0319 12 12.6716 12 13.5"}],
    ["path", {"d":"M12.125 16.75H12M12.25 16.75C12.25 16.8881 12.1381 17 12 17C11.8619 17 11.75 16.8881 11.75 16.75C11.75 16.6119 11.8619 16.5 12 16.5C12.1381 16.5 12.25 16.6119 12.25 16.75Z"}],
  ],
};

export function fileStatusIcon(document:Document, status:string):SVGSVGElement {
  const svg = iconRoot(document);
  const labels:Record<string,string> = { M:"수정 파일", A:"추가 파일", D:"삭제 파일", R:"이름 변경 파일", C:"복사 파일", U:"충돌 파일", "??":"미추적 파일", "?":"상태 확인 불가 파일" };
  const names:Record<string,string> = { M:"DiffModified", A:"DiffAdded", "??":"DiffAdded", D:"DiffRemoved", R:"DiffRenamed", C:"Copy", U:"DiffConflict", "?":"CircleQuestion" };
  const name = names[status] ?? "DiffModified";
  svg.removeAttribute("aria-hidden"); svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", labels[status] ?? "변경 파일");
  svg.setAttribute("data-bb-chat-ui-info-file-status", status);
  svg.setAttribute("data-icon", name);
  for (const [tag, attributes] of fileGlyphs[name]) {
    const element = document.createElementNS(svg.namespaceURI, tag);
    for (const [key,value] of Object.entries(attributes)) element.setAttribute(key,value);
    svg.append(element);
  }
  if (status === "A" || status === "??") svg.classList.add("text-diff-added");
  else if (status === "D") svg.classList.add("text-diff-removed");
  else if (status === "U") svg.classList.add("text-destructive");
  else svg.classList.add("text-subtle-foreground");
  return svg;
}
