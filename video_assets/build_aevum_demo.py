import asyncio, json, math, pathlib, subprocess
from PIL import Image,ImageDraw,ImageFont
import edge_tts

ROOT=pathlib.Path(__file__).resolve().parent
SPEAKER="en-GB-RyanNeural"
W,H=1920,1080
FG=(240,249,255);MUTED=(165,196,216);AQUA=(93,231,215);LIME=(120,237,164)
FONT=pathlib.Path(r"C:\Windows\Fonts")
def font(size,bold=False):
 for name in (["segoeuib.ttf","arialbd.ttf"] if bold else ["segoeui.ttf","arial.ttf"]):
  f=FONT/name
  if f.exists():return ImageFont.truetype(str(f),size)
 return ImageFont.load_default()
SCENES=[
 dict(id="01_intro",title="INVOICES ARE NOT PAYMENT PROOF",label="PROTOTYPE • TESTNET ONLY",metric="Aevum 44005",image="01_live_app.png",
 description="LDN Invoice Guard is a real interactive open-source tUSD8 invoice and proof-verification interface. No real payment has been demonstrated.",
 narration="Introducing LDN Invoice Guard, an original stablecoin invoice and proof verification prototype built for QDay Aevum Testnet. It is designed to let a merchant create a transparent invoice and check whether a specific ERC twenty transfer really settled. This demonstration is intentionally honest: the interface is working, but no test stablecoin payment has yet been completed."),
 dict(id="02_invoice",title="CREATE AN EXACT PAYMENT REQUEST",label="LIVE BROWSER CAPTURE",metric="1.000000 tUSD8",image="02_invoice_created.png",
 description="Merchant address, six-decimal test-token amount and a local invoice reference are encoded into a shareable request URL. The link is not a receipt.",
 narration="First, the merchant enters a receiving wallet address, an exact amount in test t U S D eight, and a local reference. Here you can see a genuine live browser capture creating a shareable invoice for one test token. The app uses six decimal places, matching the actual token contract. An invoice link is only a request: it does not prove anyone paid."),
 dict(id="03_validation",title="VERIFY THE CHAIN — NOT A SCREENSHOT",label="READ-ONLY ON-CHAIN CHECKS",metric="6 Confirmations",image="03_negative_proof.png",
 description="The verifier checks chain 44005, tUSD8 contract, payer, exact calldata and Transfer log, successful receipt, and at least six confirmations.",
 narration="When a real payment is available, the verifier reads QDay Aevum through a public JSON RPC endpoint. It checks the exact chain and official test token, the destination and six decimal amount, transaction input, successful receipt, and the matching Transfer event. It will not say paid until six blocks are observed. No private keys or custody are involved in verification."),
 dict(id="04_pending",title="A FAKE HASH MUST NEVER LOOK PAID",label="NEGATIVE TEST • NO TRANSFER",metric="PENDING",image="03_negative_proof.png",
 description="A deliberately nonexistent hash was checked. The actual application returned PENDING — transaction not mined — not VERIFIED.",
 narration="This is the most important negative test. We entered a deliberately nonexistent transaction hash, shown here in the real application. It returned pending, transaction not mined, and no paid status. We did not fabricate a settlement receipt, deploy a fake merchant payment, or sign an unauthorized wallet transfer. Failed and missing proofs stay clearly unverified."),
 dict(id="05_source",title="OPEN SOURCE AND REPRODUCIBLE",label="ORIGINAL CODE • LIVE TESTS",metric="18 / 18 PASS",image="04_original_source.png",
 description="Original JavaScript core. Eighteen unit tests pass, plus four public RPC checks: chain 44005, token bytecode, six decimals and current blocks.",
 narration="The project is open source, with the original verification logic visible here. Eighteen unit tests passed, including malformed amounts, wrong recipients, incorrect logs and missing confirmations. Four additional read only checks verified the live network and official token contract. Automated tests prove validation logic, not that a real test token transfer has happened."),
 dict(id="06_outro",title="NEXT MILESTONE: REAL PAYMENT PROOF",label="INVOICE GUARD • QDAY BUILDATHON",metric="NOT YET PAID",image="01_live_app.png",
 description="The faucet rejects the current address under its mainnet-holdings rule. A genuine tUSD8 payment and explorer receipt remain required before end-to-end success.",
 narration="The remaining step is a genuine owner approved transfer of test t U S D eight on Aevum, followed by its authentic receipt and six confirmations. At present the official faucet marks the connected wallet ineligible, so that on chain success is not claimed. The working public interface, source code and tests are available for inspection. This is an educational prototype, not production checkout or a promised prize.")
]
def wrap(draw,text,maxwidth,ft):
 lines=[];line=""
 for word in text.split():
  proposal=(line+" "+word).strip()
  if draw.textbbox((0,0),proposal,font=ft)[2]<=maxwidth:line=proposal
  else:
   if line:lines.append(line)
   line=word
 if line:lines.append(line)
 return lines
def render_frame(item,index):
 im=Image.new("RGB",(W,H),(8,18,31));d=ImageDraw.Draw(im)
 for y in range(0,H,3):
  d.line([(0,y),(W,y)],fill=(9+int(y/H*8),20+int(y/H*13),34+int(y/H*15)),width=3)
 d.rounded_rectangle((74,53,335,106),radius=15,fill=(24,67,75))
 d.text((97,66),"LUXEDIGITALNEST",font=font(23,True),fill=AQUA)
 d.text((372,68),"QDAY AEVUM  •  PUBLIC TESTNET  •  22 NOV 2026",font=font(22),fill=MUTED)
 d.text((75,134),item["title"],font=font(51,True),fill=FG)
 d.text((76,204),"ORIGINAL INVOICE GUARD / HONEST PROTOTYPE EVIDENCE",font=font(24),fill=MUTED)
 left,top,cw,ch=78,263,1254,695
 src=Image.open(ROOT/item["image"]).convert("RGB")
 ratio=max(cw/src.width,ch/src.height)
 src=src.resize((math.ceil(src.width*ratio),math.ceil(src.height*ratio)),Image.Resampling.LANCZOS)
 sx=(src.width-cw)//2;sy=(src.height-ch)//2
 src=src.crop((sx,sy,sx+cw,sy+ch))
 mask=Image.new("L",(cw,ch));ImageDraw.Draw(mask).rounded_rectangle((0,0,cw,ch),radius=19,fill=255)
 im.paste(src,(left,top),mask)
 d.rounded_rectangle((left-3,top-3,left+cw+3,top+ch+3),radius=22,outline=(54,113,132),width=4)
 x0,y0,x1,y1=1360,263,1840,958
 d.rounded_rectangle((x0,y0,x1,y1),radius=22,fill=(23,42,59),outline=(48,86,109),width=2)
 d.rounded_rectangle((x0+30,y0+28,x1-30,y0+82),radius=11,fill=(29,73,81))
 d.text((x0+48,y0+41),item["label"],font=font(21,True),fill=AQUA)
 d.text((x0+42,y0+121),item["metric"],font=font(40,True),fill=LIME)
 d.line([(x0+38,y0+213),(x1-38,y0+213)],width=2,fill=(61,107,122))
 f=font(27)
 y=y0+244
 for line in wrap(d,item["description"],x1-x0-78,f):
  d.text((x0+37,y),line,font=f,fill=FG)
  y+=46
 d.rounded_rectangle((x0+34,y1-112,x1-34,y1-43),radius=12,outline=(65,127,144),width=2)
 d.text((x0+50,y1-92),"NO SIGNATURE IN DEMO",font=font(22,True),fill=AQUA)
 d.text((77,1008),"REAL SOFTWARE SCREENCAPTURE • SOURCE VERIFIED • NO ON-CHAIN PAYMENT CLAIM",font=font(22),fill=MUTED)
 d.text((1710,1008),f"{index+1:02d} / 06",font=font(26,True),fill=AQUA)
 return im
async def narration(item):
 speech=edge_tts.Communicate(item["narration"],SPEAKER,rate="-1%",pitch="-5Hz",boundary="WordBoundary")
 sub=edge_tts.SubMaker()
 with (ROOT/(item["id"]+".mp3")).open("wb") as audio:
  async for event in speech.stream():
   if event["type"]=="audio":audio.write(event["data"])
   elif event["type"]=="WordBoundary":sub.feed(event)
 (ROOT/(item["id"]+".srt")).write_text(sub.get_srt(),encoding="utf-8")
def duration(name):
 p=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(ROOT/(name+".mp3"))],capture_output=True,text=True,check=True)
 return float(p.stdout.strip())
def make_scene(item,index,seconds):
 name=item["id"]
 img=ROOT/(name+".png");render_frame(item,index).save(img)
 vf=f"zoompan=z='min(zoom+0.00006,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=24,subtitles={name}.srt:force_style='FontName=Arial,FontSize=19,Outline=2,Shadow=0,MarginV=27'"
 cmd=["ffmpeg","-y","-hide_banner","-loglevel","error","-loop","1","-framerate","24","-i",name+".png","-i",name+".mp3","-vf",vf,"-af","apad=pad_dur=1.4","-t",str(round(seconds,3)),"-c:v","libx264","-preset","veryfast","-crf","22","-pix_fmt","yuv420p","-c:a","aac","-b:a","160k","-ar","48000","-movflags","+faststart",name+".mp4"]
 out=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
 if out.returncode:raise RuntimeError("ffmpeg "+name+" "+out.stderr[-1000:])
 print(json.dumps({"scene":name,"seconds":round(seconds,2),"videoBytes":(ROOT/(name+".mp4")).stat().st_size}),flush=True)
async def main():
 secs=[]
 for item in SCENES:
  await narration(item)
  x=duration(item["id"])+0.9
  secs.append(x)
  print(json.dumps({"audio":item["id"],"duration":round(x,2)}),flush=True)
 total=sum(secs)
 if total>179:raise RuntimeError(f"Video length {total}s exceeds 3 minute guard")
 for i,(item,sec) in enumerate(zip(SCENES,secs)):make_scene(item,i,sec)
 (ROOT/"concat.txt").write_text("\n".join("file '"+item["id"]+".mp4'" for item in SCENES)+"\n",encoding="ascii")
 target=ROOT/"LDN_QDay_Aevum_Invoice_Guard_Prototype_Proof_2026-11-22.mp4"
 run=subprocess.run(["ffmpeg","-y","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i","concat.txt","-c","copy","-movflags","+faststart",str(target)],cwd=ROOT,capture_output=True,text=True)
 if run.returncode:raise RuntimeError(run.stderr[-1200:])
 info=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_name,width,height","-of","json",str(target)],capture_output=True,text=True,check=True)
 (ROOT/"VIDEO_SOURCES.md").write_text("Original app browser screenshots of local port 4173 (01/02/03) captured Nov22; authentic original local src/core.mjs screenshot (04). Narration and captions are newly authored. No paid transaction, wallet signature, mainnet deposits, reward or successful tUSD8 transfer represented. Test source and live RPC independently checked. No external copyrighted background video or music.\n",encoding="utf-8")
 print(json.dumps({"RESULT":"FINAL","path":str(target),"bytes":target.stat().st_size,"info":json.loads(info.stdout)}),flush=True)
asyncio.run(main())
