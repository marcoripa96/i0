import { iconToSVG, iconToHTML, replaceIDs } from "@iconify/utils";

export function renderIconSvg(
  icon: { body: string; width: number; height: number },
  size?: number,
): { svg: string; width: number; height: number } {
  const renderData = iconToSVG(
    { body: icon.body, width: icon.width, height: icon.height },
    size ? { height: size } : {},
  );

  const body = replaceIDs(renderData.body);
  const svg = iconToHTML(body, renderData.attributes);

  return {
    svg,
    width: size ?? icon.width,
    height: size ?? icon.height,
  };
}
