import { EventEmitter } from 'events';


let parentElement;

const mount = () => {
	parentElement = document.body;
};

const get = (serverUrl) => parentElement.querySelector(`.webview[data-server="${ serverUrl }"]`);

const getActive = () => parentElement.querySelector('.webview.active');

class WebView extends EventEmitter {
	isActive(hostUrl) {
		return !!parentElement.querySelector(`.webview.active[data-server="${ hostUrl }"]`);
	}

	deactiveAll() {
		let item;
		while (!(item = getActive()) === false) {
			item.classList.remove('active');
		}
		document.querySelector('.landing-page').classList.add('hide');
	}

	setActive(hostUrl) {
		if (this.isActive(hostUrl)) {
			return;
		}

		this.deactiveAll();
		const item = get(hostUrl);
		if (item) {
			item.classList.add('active');
		}
		this.focusActive();
	}

	focusActive() {
		const active = getActive();
		if (active) {
			active.focus();
		}
	}

	goBack() {
		getActive().goBack();
	}

	goForward() {
		getActive().goForward();
	}

	setSidebarPaddingEnabled(enabled) {
		if (process.platform !== 'darwin') {
			return;
		}

		Array.from(document.querySelectorAll('webview.ready'))
			.filter((webviewObj) => webviewObj.insertCSS)
			.forEach((webviewObj) => webviewObj.insertCSS(`
				.sidebar {
					padding-top: ${ enabled ? '10px' : '0' };
					transition: margin .5s ease-in-out;
				}
			`));
	}
}

const events = new WebView();

const handleDidNavigateInPage = ({ url: serverUrl }, webview, { url }) => {
	if (url.indexOf(serverUrl) === 0) {
		events.emit('did-navigate', { serverUrl, url });
	}
};

const handleConsoleMessage = ({ url: serverUrl }, webview, { level, line, message, sourceId }) => {
	const levelFormatting = {
		[-1]: 'color: #999',
		0: 'color: #666',
		1: 'color: #990',
		2: 'color: #900',
	}[level];
	const danglingFormatting = (message.match(/%c/g) || []).map(() => '');
	console.log(`%c${ serverUrl }\t%c${ message }\n${ sourceId } : ${ line }`,
		'font-weight: bold', levelFormatting, ...danglingFormatting);
};

const handleIpcMessage = (server, webview, { channel, args }) => {
	events.emit(`ipc-message-${ channel }`, server, ...args);
};

const handleDomReady = ({ url: serverUrl }, webview) => {
	webview.classList.add('ready');
	events.emit('dom-ready', webview, serverUrl);
};

const handleDidFailLoad = (server, webview, { isMainFrame }) => {
	if (isMainFrame) {
		webview.loadURL(`file://${ __dirname }/loading-error.html`);
	}
};

const handleDidGetResponseDetails = (server, webview, { resourceType, httpResponseCode }) => {
	if (resourceType === 'mainFrame' && httpResponseCode >= 500) {
		webview.loadURL(`file://${ __dirname }/loading-error.html`);
	}
};

const add = (server) => {
	let webview = get(server.url);
	if (webview) {
		return;
	}

	webview = document.createElement('webview');
	webview.classList.add('webview');
	webview.dataset.server = server.url;
	webview.setAttribute('preload', '../preload.js');
	webview.setAttribute('allowpopups', 'on');
	webview.setAttribute('disablewebsecurity', 'on');

	webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage.bind(null, server, webview));
	webview.addEventListener('console-message', handleConsoleMessage.bind(null, server, webview));
	webview.addEventListener('ipc-message', handleIpcMessage.bind(null, server, webview));
	webview.addEventListener('dom-ready', handleDomReady.bind(null, server, webview));
	webview.addEventListener('did-fail-load', handleDidFailLoad.bind(null, server, webview));
	webview.addEventListener('did-get-response-details', handleDidGetResponseDetails.bind(null, server, webview));

	parentElement.appendChild(webview);

	webview.setAttribute('src', server.lastPath || server.url);
};

const remove = ({ url: serverUrl }) => {
	const webview = get(serverUrl);
	if (webview) {
		webview.remove();
	}
};

export const webviews = Object.assign(events, {
	mount,
	add,
	remove,
	get,
	getActive,
});
