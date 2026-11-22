import base64,json,os,sys
here=os.path.dirname(os.path.abspath(__file__)); seed=os.path.join(here,'../../docs/seed')
names=['hoodie-black','coat-black','jeans-indigo','shoes-white','jacket-black','tshirt-black','accessories-grey']
imgs={n:'data:image/svg+xml;base64,'+base64.b64encode(open(f'{seed}/{n}.svg','rb').read()).decode() for n in names}
src=open(os.path.join(here,'ai-manager.src.html')).read().replace('{{IMAGES}}',json.dumps(imgs))
open(sys.argv[1],'w').write(src)
