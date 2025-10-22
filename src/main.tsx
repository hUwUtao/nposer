// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
import App from "./App.tsx";

// createRoot(document.getElementById('root')!).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )

import { hydrate, prerender as ssr } from "preact-iso";

if (typeof window !== "undefined") {
	hydrate(<App />, document.getElementById("app"));
}

export async function prerender(data) {
	return await ssr(<App {...data} />);
}
