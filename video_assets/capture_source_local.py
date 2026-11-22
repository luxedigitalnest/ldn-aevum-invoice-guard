import asyncio, pathlib,json
from playwright.async_api import async_playwright
OUT=pathlib.Path(r"C:\Users\gevab\Documents\ChatGPT\Crypto\ldn-aevum-invoice-guard\video_assets")
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(channel="chrome",headless=True)
  c=await b.new_context(viewport={"width":1600,"height":900},color_scheme="dark")
  page=await c.new_page()
  url=pathlib.Path(r"C:\Users\gevab\Documents\ChatGPT\Crypto\ldn-aevum-invoice-guard\src\core.mjs").as_uri()
  await page.goto(url,wait_until="load",timeout=15000)
  await page.screenshot(path=str(OUT/"04_original_source.png"),full_page=False)
  print(json.dumps({"source":url,"title":await page.title(),"codeLength":len(await page.locator("body").inner_text()),"file":str(OUT/"04_original_source.png")}),flush=True)
  await c.close();await b.close()
asyncio.run(main())
