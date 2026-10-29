/** 水果以半径 50 的坐标绘制，供战场、预览和封面共用。 */
export const FRUIT_NAMES = [
  "蓝莓",
  "草莓",
  "葡萄",
  "桃子",
  "柠檬",
  "李子",
  "橙子",
  "苹果",
  "菠萝",
  "蜜瓜",
  "西瓜",
];
const palettes = [
  ["#7bb9e3", "#427aab"],
  ["#ff8c80", "#d45f54"],
  ["#d982ac", "#a14e7a"],
  ["#ffb594", "#de786b"],
  ["#f7d96b", "#d9af42"],
  ["#b989b4", "#865d8b"],
  ["#ffb55c", "#da8a3f"],
  ["#f58b80", "#c85d58"],
  ["#f5d46c", "#d4aa44"],
  ["#d3de83", "#a5b45f"],
  ["#88bb79", "#508453"],
];
const leaf =
  '<path d="M-2-36Q6-55 23-43Q18-27-2-36" fill="#81aa61" stroke="#557b47" stroke-width="3"/><path d="M-2-34Q-4-43-10-47" fill="none" stroke="#866342" stroke-width="4"/>';
function artwork(level) {
  const [fill, edge] = palettes[level];
  let detail = "";
  if (level === 0)
    detail =
      '<path d="m-12-33 9-4 7-8 5 8 10 2-8 6-1 9-9-5-10 2 2-9Z" fill="#5295bc" stroke="#427aab" stroke-width="2"/>';
  if (level === 1)
    detail =
      '<path d="m-26-31 15-3 2-12 13 8 14-7 1 13 12 5-19 6-12-7-13 6Z" fill="#85af65" stroke="#5e884c" stroke-width="3"/>' +
      [-30, -14, 4, 23, 32]
        .map(
          (x, i) =>
            `<ellipse cx="${x}" cy="${i % 2 ? 29 : -15}" rx="2" ry="4" fill="#ffe3ad"/>`,
        )
        .join("");
  if (level === 2)
    detail =
      [
        [-21, -21],
        [7, -25],
        [26, -9],
        [-30, 5],
        [-18, 27],
        [10, 30],
        [29, 15],
      ]
        .map(
          ([x, y]) =>
            `<path d="M${x - 9} ${y}q9 9 18 0" fill="none" stroke="${edge}" stroke-width="3" opacity=".48"/>`,
        )
        .join("") + leaf;
  if ([3, 5, 6, 7, 9].includes(level)) detail = leaf;
  if (level === 3)
    detail +=
      '<path d="M2-34Q-7-17-3-6M-2 32l1 11" fill="none" stroke="#e78c79" stroke-width="3"/>';
  if (level === 4 || level === 6)
    detail += [
      [-29, -20],
      [25, -25],
      [-33, 18],
      [29, 25],
      [-12, 34],
      [17, 36],
    ]
      .map(
        ([x, y]) =>
          `<circle cx="${x}" cy="${y}" r="2" fill="${edge}" opacity=".5"/>`,
      )
      .join("");
  if (level === 8)
    detail =
      '<path d="M-33-23 25 35M-40-3 1 38M-13-37 37 13M33-23-25 35M40-3-1 38M13-37-37 13" stroke="#d5ae48" stroke-width="2" opacity=".65"/><path d="m-23-31-5-16 18 7 8-12 11 13 18-5-9 16Z" fill="#82a959" stroke="#5c8449" stroke-width="3"/>';
  if (level === 9)
    detail +=
      '<path d="M-34-28Q0-10 34-28M-43-8Q0 12 43-8M-38 18Q0 40 38 18M-22-39Q-5 0-22 39M22-39Q5 0 22 39" fill="none" stroke="#b1c06e" stroke-width="2"/>';
  if (level === 10)
    detail =
      '<path d="M-27-36Q-8-15-26 0T-27 36M0-45Q18-20 0 0T0 45M27-36Q45-14 27 0T27 36" fill="none" stroke="#558c56" stroke-width="8" stroke-linecap="round"/>';
  const eyes =
    level === 2 || level === 8
      ? '<path d="M-22 5q6 8 12 0M10 5q6 8 12 0" fill="none" stroke-width="4"/>'
      : '<path d="M-16 2v6M16 2v6" stroke-width="5"/>';
  return `<g stroke-linecap="round" stroke-linejoin="round"><circle cy="3" r="47" fill="${edge}" opacity=".16"/><circle r="46" fill="${fill}" stroke="${edge}" stroke-width="3.5"/>${detail}<ellipse cx="-22" cy="-25" rx="11" ry="6" transform="rotate(-35 -22 -25)" fill="#fff9e9" opacity=".55"/><g fill="#ec8a8d" opacity=".5"><ellipse cx="-26" cy="15" rx="7" ry="4"/><ellipse cx="26" cy="15" rx="7" ry="4"/></g><g stroke="#654844">${eyes}<path d="M-6 17q6 8 12 0" fill="none" stroke-width="3.8"/></g></g>`;
}
export function fruitDefs() {
  return FRUIT_NAMES.map(
    (name, i) => `<g id="orchard-fruit-${i}">${artwork(i)}</g>`,
  ).join("");
}
export function fruitUse(level, radius, x = 0, y = 0) {
  return `<use href="#orchard-fruit-${level}" transform="translate(${x} ${y}) scale(${radius / 50})"/>`;
}
export const gingham =
  '<pattern id="orchard-gingham" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="#fff0bd"/><path d="M0 12H48" stroke="#f8d98f" stroke-width="24" opacity=".36"/><path d="M12 0V48" stroke="#f8d98f" stroke-width="24" opacity=".36"/></pattern>';
