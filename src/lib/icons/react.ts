const KEEP_ATTRIBUTES = new Set(["viewBox", "width", "height", "focusable", "xmlns", "xlink"]);

function toComponentName(icon: string): string {
  return icon
    .split(/[:\-_]/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase())
    .join("");
}

function cleanSvg(svg: string): string {
  // Strip attributes from <svg> that aren't in the keep list
  return svg.replace(/<svg\s([^>]*)>/, (_match, attrs: string) => {
    const kept = (attrs.match(/[\w:-]+=(?:"[^"]*"|'[^']*')/g) || []).filter(
      (attr) => {
        const name = attr.split("=")[0];
        return KEEP_ATTRIBUTES.has(name);
      }
    );
    return `<svg ${kept.join(" ")}>`;
  });
}

function htmlToJsx(html: string): string {
  return (
    html
      // Convert kebab-case attributes to camelCase (but not stroke-xxx yet)
      .replace(/([\w-]+)=/g, (match) => {
        const words = match.split("-");
        if (words.length === 1 || words[0] === "stroke") return match;
        return words
          .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
          .join("");
      })
      // Convert class= to className=, stroke-xxx and colon attrs to camelCase
      .replace(/(class|(stroke-\w+)|(\w+:\w+))=/g, (match) => {
        if (match === "class=") return "className=";
        return match
          .split(/[:\-]/)
          .map((part, i) => (i === 0 ? part.toLowerCase() : part[0].toUpperCase() + part.slice(1).toLowerCase()))
          .join("");
      })
      .replace(/<!--/g, "{/*")
      .replace(/-->/g, "*/}")
  );
}

export function svgToReactComponent(svg: string, fullName: string): string {
  const componentName = toComponentName(fullName);
  const cleaned = cleanSvg(svg);
  const jsx = htmlToJsx(cleaned).replace(/<svg\s/, "<svg {...props} ");

  return `import type { SVGProps } from "react";

export function ${componentName}(props: SVGProps<SVGSVGElement>) {
  return (
    ${jsx}
  );
}

export default ${componentName};`;
}
