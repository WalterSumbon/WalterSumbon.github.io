import { readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
/** 扫描文章文件名；标题、作者等信息仅存在于 Markdown。 */
export async function updateIndex() {
  const files = (await readdir(path.join(root, "content/posts")))
    .filter((x) => x.endsWith(".md"))
    .sort();
  await writeFile(
    path.join(root, "content/index.json"),
    JSON.stringify(files, null, 2) + "\n",
  );
  return files;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const start = performance.now();
  console.log("开始扫描文章目录");
  console.log(
    `完成：${(await updateIndex()).length} 篇，${Math.round(performance.now() - start)} ms`,
  );
}
