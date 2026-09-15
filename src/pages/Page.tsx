import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonImg, IonMenuButton, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import { useEffect, useState } from 'react';
import './Page.css';
import { keyOutline, logoGoogle, mailOutline, personAddOutline } from 'ionicons/icons';

const ArrowDiagram: React.FC = () => {
  const [lines, setLines] = useState<{ startX: number, startY: number, endX: number, endY: number }[]>([]);

  useEffect(() => {
    const updateLines = () => {
      const container = document.getElementById('diagram-container');
      const wn = document.getElementById('wrapper-notes');
      const wp = document.getElementById('wrapper-papers');
      const wm = document.getElementById('wrapper-materials');
      const wd = document.getElementById('wrapper-digests');

      if (container && wn && wp && wm && wd) {
        const cRect = container.getBoundingClientRect();

        const getCenter = (el: HTMLElement) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.left - cRect.left + rect.width / 2,
            y: rect.top - cRect.top + rect.height / 2
          };
        };

        const n = getCenter(wn);
        const p = getCenter(wp);
        const m = getCenter(wm);
        const d = getCenter(wd);

        setLines([
          { startX: n.x, startY: n.y + 25, endX: m.x - 25, endY: m.y - 35 },
          { startX: p.x, startY: p.y + 25, endX: m.x + 25, endY: m.y - 35 },
          { startX: m.x, startY: m.y + 25, endX: d.x, endY: d.y - 30 }
        ]);
      }
    };

    setTimeout(updateLines, 100);
    window.addEventListener('resize', updateLines);
    return () => window.removeEventListener('resize', updateLines);
  }, []);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill="#cbd5e1" />
        </marker>
      </defs>
      {lines.map((line, i) => (
        <path
          key={i}
          d={`M ${line.startX} ${line.startY} C ${line.startX} ${line.startY + 40}, ${line.endX} ${line.endY - 40}, ${line.endX} ${line.endY}`}
          stroke="#cbd5e1"
          strokeWidth="2"
          fill="none"
          strokeDasharray="5 5"
          markerEnd="url(#arrowhead)"
        />
      ))}
    </svg>
  );
};

const ShortFeature: React.FC = () => {
  return (
    <div id="diagram-container" className='block max-w-[460px] mx-auto relative'>
      <ArrowDiagram />
      <div className='flex justify-between relative z-10'>
        <div id="wrapper-notes" className='block pl-[5%]'>
          <div id="notes" className='featbox rounded-full border border-neutral-100 shadow-lg px-4 py-3 w-[160px] flex items-center gap-3 bg-white'>
            <IonImg className='w-10 h-auto mx-auto' src='/icons/paper.png'></IonImg>
            <IonText className='text-xs leading-4'>Your Notes Collection</IonText>
          </div>
        </div>

        <div id="wrapper-papers" className='block pt-6'>
          <div id="papers" className='featbox rounded-full border border-neutral-100 shadow-lg px-4 py-3 w-[120px] flex items-center gap-3 bg-white' style={{ animationDelay: '1s' }}>
            <IonImg className='w-10 h-auto mx-auto' src='/icons/research.png'></IonImg>
            <IonText className='text-xs leading-4'>Research Papers</IonText>
          </div>
        </div>
      </div>

      <div className='flex justify-center pt-12 pr-[20%] relative z-10'>
        <div id="wrapper-materials" className='block'>
          <div id="materials" className='featbox rounded-full border border-neutral-100 shadow-lg px-4 py-3 w-[200px] flex items-center gap-3 bg-white' style={{ animationDelay: '2s' }}>
            <IonImg className='w-10 h-auto mx-auto' src='/icons/learning-material.png'></IonImg>
            <IonText className='text-xs leading-4'>Enhanced Learning Material</IonText>
          </div>
        </div>
      </div>

      <div className='flex justify-center pt-12 pl-[30%] relative z-10'>
        <div id="wrapper-digests" className='block pt-2'>
          <div id="digests" className='featbox rounded-full border border-neutral-100 shadow-lg px-4 py-3 w-[160px] flex items-center gap-3 bg-white' style={{ animationDelay: '0.5s' }}>
            <IonImg className='w-10 h-auto mx-auto' src='/icons/explaination.png'></IonImg>
            <IonText className='text-xs leading-4'>Weekly Digests</IonText>
          </div>
        </div>
      </div>
    </div>
  )
}

const Page: React.FC = () => {
  const { name = '' } = useParams<{ name: string; }>();

  return (
    <IonPage>
      <IonContent className='ion-padding' scrollY={true} fullscreen>
        <div className='flex flex-col w-full h-full ion-padding-top'>
          <div className='block ion-tcenter mt-auto mb-2'>
            <ShortFeature />
          </div>

          <div className='block mt-auto'>
            <h3 className='block ion-text-center !mb-2'>
              <IonText className='text-sm uppercase text-neutral-600 tracking-widest'>
                Welcome to Ritize
              </IonText>
            </h3>

            <h1 className='block ion-text-center !mt-0 px-3'>
              <IonText className='text-2xl font-bold'>
                {/* Exchange lecture notes to assist studies every day. */}
                Note taking for power students, assist studies on every moment.
              </IonText>
            </h1>

            <div className='block text-center mt-4 mb-6'>
              <div className='flex flex-col gap-4 justify-center items-center'>
                <IonButton
                  routerLink="/oauth-google"
                  color={'dark'}
                  mode={'ios'}
                  shape='round'
                  className='items-center gap-6'
                >
                  <IonIcon slot='start' icon={logoGoogle} />
                  <IonText className='ml-2'>Continue with Google</IonText>
                </IonButton>
              </div>

              <div className="flex items-center justify-center gap-3 mt-6">
                <div className="h-px bg-gray-200 w-[20%]"></div>

                <span className="text-sm text-gray-400 whitespace-nowrap">
                  or use email
                </span>

                <div className="h-px bg-gray-200 w-[20%]"></div>
              </div>

              <div className='flex flex-row gap-6 items-center justify-center'>
                <div className='block'>
                  <IonButton
                    routerLink="/register"
                    routerDirection="root"
                    color={'primary'}
                    mode={'ios'}
                    shape='round'
                    className='items-center gap-3'
                    fill='clear'
                  >
                    <IonIcon slot='start' icon={personAddOutline} />
                    <IonText className='ml-2'>Register</IonText>
                  </IonButton>
                </div>

                <div className='block'>
                  <IonButton
                    routerLink="/login"
                    routerDirection="root"
                    color={'primary'}
                    mode={'ios'}
                    shape='round'
                    className='items-center gap-3'
                    fill='clear'
                  >
                    <IonIcon slot='start' icon={keyOutline} />
                    <IonText className='ml-2'>Login</IonText>
                  </IonButton>
                </div>
              </div>

              {/* <div className='block text-center mt-4'>
                <IonButton color={'primary'} fill="clear" mode={'ios'} shape='round' className='items-center gap-3'>
                  <IonIcon slot='start' icon={mailOutline} />
                  <IonText className='ml-2'>Use an Email</IonText>
                </IonButton>
              </div> */}
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Page;
