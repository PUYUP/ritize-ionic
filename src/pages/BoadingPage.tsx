import { IonButton, IonContent, IonImg, IonPage, IonText } from '@ionic/react';
import './Page.css';
import { useEffect, useRef, useState } from 'react';
import Swiper from 'swiper';
import { FreeMode, Pagination } from 'swiper/modules';
import LearnGraph from '../components/learn-graph/LearnGraph';

const ArrowDiagram: React.FC = () => {
	const [lines, setLines] = useState<{ startX: number, startY: number, endX: number, endY: number }[]>([]);

	useEffect(() => {
		const updateLines = () => {
			const container = document.getElementById('diagram-container');
			const wn = document.getElementById('wrapper-notes');
			const wp = document.getElementById('wrapper-papers');
			const wm = document.getElementById('wrapper-materials');
			const wcb = document.getElementById('wrapper-chatbot');

			if (container && wn && wp && wm && wcb) {
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
				const cb = getCenter(wcb);

				setLines([
					// Notes to Materials
					{ startX: n.x, startY: n.y + 5, endX: m.x - 25, endY: m.y - 35 },
					// Papers to Materials
					{ startX: p.x, startY: p.y + 25, endX: m.x + 25, endY: m.y - 35 },
					// Chatbot to Materials
					{ startX: cb.x, startY: cb.y - 25, endX: m.x, endY: m.y + 35 }
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
			{lines.map((line, i) => {
				const isUpward = line.startY > line.endY;
				const c1y = isUpward ? line.startY - 40 : line.startY + 40;
				const c2y = isUpward ? line.endY + 40 : line.endY - 40;

				return (
					<path
						key={i}
						d={`M ${line.startX} ${line.startY} C ${line.startX} ${c1y}, ${line.endX} ${c2y}, ${line.endX} ${line.endY}`}
						stroke="#cbd5e1"
						strokeWidth="2"
						fill="none"
						strokeDasharray="5 5"
						markerEnd="url(#arrowhead)"
					/>
				);
			})}
		</svg>
	);
};

const ShortFeature: React.FC = () => {
	return (
		<div id="diagram-container" className='block max-w-[460px] mx-auto relative'>
			<ArrowDiagram />
			<div className='flex justify-between relative z-10'>
				<div id="wrapper-notes" className='block pl-[5%]'>
					<div id="notes" className='featbox rounded-full border border-neutral-100 shadow-lg px-3 py-1 w-[140px] flex items-center gap-0 bg-white'>
						<IonImg className='w-8 h-auto mx-auto flex-none' src='/icons/paper.png'></IonImg>
						<IonText className='text-sm leading-4 albert-font !font-light'>Your Notes</IonText>
					</div>
				</div>

				<div id="wrapper-papers" className='block pt-6'>
					<div id="papers" className='featbox rounded-full border border-neutral-100 shadow-lg px-3 py-1 w-[130px] flex items-center gap-2 bg-white' style={{ animationDelay: '1s' }}>
						<IonImg className='w-auto h-6 mx-auto flex-none' src='/icons/research.png'></IonImg>
						<IonText className='text-xs leading-4 albert-font !font-light'>Research Papers</IonText>
					</div>
				</div>
			</div>

			<div className='flex justify-center pt-12 relative z-10'>
				<div id="wrapper-materials" className='block'>
					<div id="materials" className='featbox rounded-full border border-neutral-100 shadow-lg px-3 py-2 w-[220px] flex items-center gap-2 bg-white relative' style={{ animationDelay: '2s' }}>
						<IonImg className='w-8 h-auto mx-auto flex-none' src='/icons/learning-material.png'></IonImg>
						<IonText className='text-sm leading-4 albert-font !font-light'>
							<strong>AI Enhanced</strong> <i>while you sleep.</i>
						</IonText>
						<IonImg src={'/icons/sleeping.png'} className='absolute -top-2 -right-2 w-7 h-7'></IonImg>
					</div>
				</div>
			</div>

			<div className='flex justify-center pt-16 relative z-10'>
				<div id="wrapper-chatbot" className='block'>
					<div id="chatbot" className='featbox rounded-full border border-neutral-100 shadow-lg px-3 py-2 w-[140px] flex items-center gap-2 bg-white' style={{ animationDelay: '0.75s' }}>
						<IonImg className='w-auto h-8 mx-auto flex-none' src='/icons/ai-language-model.png'></IonImg>
						<IonText className='text-xs leading-4 albert-font !font-light'>Chat with Own Notes</IonText>
					</div>
				</div>
			</div>
		</div>
	)
}

const BoadingPage: React.FC = () => {
	const pagesSwiperElRef = useRef<HTMLDivElement>(null);
	const pagesSwiperRef = useRef<Swiper | null>(null);

	// Initialize the pages Swiper once and clean it up on unmount.
	useEffect(() => {
		const containerEl = pagesSwiperElRef.current;
		if (!containerEl) return;

		pagesSwiperRef.current = new Swiper(containerEl, {
			modules: [FreeMode, Pagination],
			direction: 'horizontal',
			slidesPerView: 1,
			spaceBetween: 0,
			freeMode: false,
			resistanceRatio: 0,
			watchOverflow: true,
			observer: true,
			observeParents: true,
			history: true,
			// pagination: {
			// 	el: '.swiper-pagination',
			// 	clickable: true,
			// },
		});

		return () => {
			pagesSwiperRef.current?.destroy(true, true);
			pagesSwiperRef.current = null;
		};
	}, []);

	return (
		<IonPage>
			<IonContent color="light" className='ion-padding' scrollY={true} fullscreen>
				<div ref={pagesSwiperElRef} className='swiper h-full relative'>
					<div className='swiper-wrapper flex flex-row h-full'>
						{/* slide 1 */}
						<div className='swiper-slide h-full'>
							<div className="w-full h-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
								<div className='flex flex-col w-full h-full ion-padding-top'>
									<div className='block ion-tcenter mt-auto mb-2'>
										<ShortFeature />
									</div>

									<div className='block mt-auto'>
										<h3 className='block ion-text-center !mb-2'>
											<IonText className='text-sm uppercase text-neutral-600 tracking-widest font-normal oswald-font'>
												Welcome to <strong>Ritize!</strong>
											</IonText>
										</h3>

										<h1 className='block ion-text-center !mt-0 px-3'>
											<IonText className='text-3xl font-bold'>
												{/* Exchange lecture notes to assist studies every day. */}
												Power up your study notes & assist <strong className='text-[#ec8d39] font-bold'>while you sleep.</strong>
											</IonText>
										</h1>

										<div className='block text-center mt-6 mb-6'>
											<div className='flex flex-col gap-4 justify-center items-center'>
												<IonButton
													onClick={() => pagesSwiperRef.current?.slideNext()}
													color={'dark'}
													mode={'md'}
													shape='round'
													className='items-center gap-6 cta-button'
												>
													<IonText className='ml-2'>Continue</IonText>
												</IonButton>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
						{/* end slide 1 */}

						{/* slide 2 */}
						<div className='swiper-slide h-full'>
							<div className='flex flex-col w-full h-full ion-padding-top'>
								<div className='block ion-tcenter mt-auto mb-8 mt-auto'>
									<div className='w-full mx-auto relative'>
										<LearnGraph days={[]} />
									</div>
								</div>

								<div className='block'>
									<div className="w-full h-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
										<h3 className='block ion-text-center !mb-2'>
											<IonText className='text-sm uppercase text-neutral-600 tracking-widest font-normal oswald-font'>
												Capture the <strong>journey</strong>
											</IonText>
										</h3>

										<h1 className='block ion-text-center !mt-0 px-3'>
											<IonText className='text-3xl font-bold'>
												Every study takes time. Track it with <strong className='text-[#ec8d39] font-bold'>minimalist logs.</strong>
											</IonText>
										</h1>

										<div className='block text-center mt-6 mb-6'>
											<div className='flex flex-col gap-4 justify-center items-center'>
												<IonButton
													routerLink="/oauth-google"
													color={'dark'}
													mode={'md'}
													shape='round'
													className='items-center gap-6 cta-button'
												>
													<IonText className='ml-2'>Continue</IonText>
												</IonButton>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
						{/* end slide 2 */}

					</div>

				</div>
			</IonContent>
		</IonPage>
	);
};

export default BoadingPage;
