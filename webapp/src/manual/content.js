// FarmSense Brew User Manual: one source for the in-app flipbook, the text
// view and the printable PDF, in English, casual Tagalog and Taglish.
// Each section follows the Barakollect format (Purpose, How to use, Key
// features). English is the base; `tl` and `taglish` hold the same fields.
// `shots` are screenshots in ./shots from the local tutorial copy
// (replay of recorded farm readings).

export const LANGS = [
  { key: 'tl', label: 'Tagalog' },
  { key: 'taglish', label: 'Taglish' },
  { key: 'en', label: 'English' },
];

/// Field staff read the manual in Tagalog first; everyone else in English.
export const defaultLang = (role) => (role === 'field_staff' ? 'tl' : 'en');

export const ROLE_NAMES = {
  admin: 'System Admin',
  agronomist: 'Agronomist',
  farm_owner: 'Farm Owner',
  field_staff: 'Field Staff',
};

// Words around the content (headings, labels, captions).
export const UI = {
  en: {
    purpose: 'Purpose.', how: 'How to use', features: 'Key features.', note: 'Note.', contents: 'Contents',
    continued: '(continued)', figure: 'Figure', caption: 'Screenshot from a local copy of the system replaying recorded farm readings.',
    gettingStarted: 'Getting started', yourScreens: (r) => `Your screens (${r})`, roleScreens: (r) => `${r} screens`, help: 'Help',
    overviewTitle: 'System overview and user roles', footer: 'FarmSense Brew User Manual', notes: 'Notes',
    edition: (r) => `${r} edition`, guideFor: (r) => `Guide for the ${r} account`, search: 'Search the manual',
    nothing: (q) => `Nothing in the manual matches "${q}".`, bookView: 'Book view', open: (t) => `Open ${t}`,
    homeFig: 'The FarmSense Brew home page.', roleCol: 'Role', doesCol: 'What the role does',
    views: { book: 'Book', video: 'Video', text: 'Text' },
    videoNote: 'Taglish captions explain each step as it happens. Recorded on a local copy of the system replaying recorded farm readings; nothing was saved.',
    noVideo: 'The video for this role is not available yet.',
    about: 'FarmSense Brew watches the microclimate around the Liberica coffee at Javier Permaculture Farm and helps decide when to water. Five sensor nodes report air temperature, humidity and soil moisture to a Raspberry Pi 4 server on the farm. The web app shows each node\'s coffee leaf rust (CLR) risk, alerts, recommendations and the state of three irrigation valves.',
    terms: 'A node is a sensor station (Node 1 to Node 5). A valve waters one side of the plot: Valve 1 the west (Nodes 1 and 4), Valve 2 the centre (Node 3), Valve 3 the east (Nodes 2 and 5).',
  },
  tl: {
    purpose: 'Para saan.', how: 'Paano gamitin', features: 'Mga dapat malaman.', note: 'Paalala.', contents: 'Laman',
    continued: '(tuloy)', figure: 'Larawan', caption: 'Screenshot mula sa kopya ng system sa laptop na nagpe-play ng totoong naitalang reading sa farm.',
    gettingStarted: 'Pagsisimula', yourScreens: (r) => `Mga screen mo (${r})`, roleScreens: (r) => `Mga screen ng ${r}`, help: 'Tulong',
    overviewTitle: 'Tungkol sa system at sa mga role', footer: 'FarmSense Brew User Manual', notes: 'Mga Tala',
    edition: (r) => `Para sa ${r}`, guideFor: (r) => `Gabay para sa account ng ${r}`, search: 'Maghanap sa manual',
    nothing: (q) => `Walang lumabas para sa "${q}".`, bookView: 'Libro', open: (t) => `Buksan ang ${t}`,
    homeFig: 'Ang home page ng FarmSense Brew.', roleCol: 'Role', doesCol: 'Ano ang trabaho',
    views: { book: 'Libro', video: 'Video', text: 'Teksto' },
    videoNote: 'May Taglish na caption na nagpapaliwanag ng bawat hakbang habang ginagawa. Kinuha sa kopya ng system sa laptop na nagpe-play ng totoong naitalang reading; walang na-save.',
    noVideo: 'Wala pang video para sa role na ito.',
    about: 'Binabantayan ng FarmSense Brew ang panahon sa paligid ng mga kape (Liberica) sa Javier Permaculture Farm at tumutulong magdesisyon kung kailan magdidilig. Limang sensor node ang nagpapadala ng init, humidity at basa ng lupa sa Raspberry Pi 4 na server sa farm. Sa web app makikita ang tsansa ng kalawang (CLR) ng bawat node, mga alert, mga payo at kung bukas o sarado ang tatlong balbula ng tubig.',
    terms: 'Ang node ay isang sensor station (Node 1 hanggang Node 5). Ang valve o balbula ang nagdidilig sa isang parte ng plot: Valve 1 sa kanluran (Node 1 at 4), Valve 2 sa gitna (Node 3), Valve 3 sa silangan (Node 2 at 5).',
  },
  taglish: {
    purpose: 'Para saan.', how: 'Paano gamitin', features: 'Key features.', note: 'Note.', contents: 'Contents',
    continued: '(tuloy)', figure: 'Figure', caption: 'Screenshot from a local copy ng system na nagre-replay ng recorded farm readings.',
    gettingStarted: 'Getting started', yourScreens: (r) => `Screens mo (${r})`, roleScreens: (r) => `${r} screens`, help: 'Help',
    overviewTitle: 'System overview at user roles', footer: 'FarmSense Brew User Manual', notes: 'Notes',
    edition: (r) => `${r} edition`, guideFor: (r) => `Guide para sa ${r} account`, search: 'Search sa manual',
    nothing: (q) => `Walang match sa manual para sa "${q}".`, bookView: 'Book view', open: (t) => `Open ${t}`,
    homeFig: 'Ang home page ng FarmSense Brew.', roleCol: 'Role', doesCol: 'Anong ginagawa',
    views: { book: 'Book', video: 'Video', text: 'Text' },
    videoNote: 'May Taglish captions na nag-e-explain ng bawat step habang ginagawa. Recorded sa local copy ng system na nagre-replay ng recorded farm readings; walang na-save.',
    noVideo: 'Wala pang video para sa role na ito.',
    about: 'Mino-monitor ng FarmSense Brew ang microclimate sa paligid ng Liberica coffee sa Javier Permaculture Farm at tumutulong mag-decide kung kailan magwa-water. Limang sensor nodes ang nagse-send ng air temperature, humidity at soil moisture sa Raspberry Pi 4 server sa farm. Sa web app makikita ang coffee leaf rust (CLR) risk ng bawat node, alerts, recommendations at status ng tatlong irrigation valves.',
    terms: 'Ang node ay sensor station (Node 1 to Node 5). Ang valve ang nagwa-water sa isang side ng plot: Valve 1 sa west (Nodes 1 at 4), Valve 2 sa center (Node 3), Valve 3 sa east (Nodes 2 at 5).',
  },
};

export const ROLES_TABLE = {
  en: [
    ['Agronomist', 'Reads sensor data, CLR risk and trends; records actions on alerts; sets irrigation.'],
    ['Farm Owner', 'Sees the farm summary, recommendations and reports; sets irrigation; adds nodes.'],
    ['Field Staff', 'Follows node instructions, records completed work, waters by hand or by schedule.'],
    ['System Admin', 'Manages accounts, password requests, sensor boxes, the audit log and the server.'],
  ],
  tl: [
    ['Agronomist', 'Tumitingin sa sensor data, tsansa ng kalawang at trend; nagre-record ng aksyon sa alert; nag-aayos ng dilig.'],
    ['Farm Owner', 'Nakikita ang buod ng farm, mga payo at report; nag-aayos ng dilig; nagdadagdag ng node.'],
    ['Field Staff', 'Sumusunod sa utos ng bawat node, nire-record ang nagawa, nagdidilig gamit ang switch o schedule.'],
    ['System Admin', 'Humahawak ng mga account, password request, sensor box, audit log at server.'],
  ],
  taglish: [
    ['Agronomist', 'Nagche-check ng sensor data, CLR risk at trends; nagre-record ng action sa alerts; nagse-set ng irrigation.'],
    ['Farm Owner', 'Nakikita ang farm summary, recommendations at reports; nagse-set ng irrigation; nag-a-add ng nodes.'],
    ['Field Staff', 'Sumusunod sa instructions ng node, nire-record ang ginawa, nagwa-water via switch o schedule.'],
    ['System Admin', 'Nagma-manage ng accounts, password requests, sensor boxes, audit log at server.'],
  ],
};

// ---------------------------------------------------------------- shared
export const GETTING_STARTED = [
  {
    id: 'sign-in',
    shots: ['03-login'],
    en: {
      title: 'Signing in', screen: 'Home page and sign-in',
      purpose: 'Open the dashboard assigned to your work at Javier Permaculture Farm.',
      steps: [
        'Connect to the farm Wi-Fi and open the FarmSense Brew web address given by the System Admin.',
        'Select Sign in. All accounts use the same login page.',
        'Enter your own username and password, then select Login. Use Show password only when nobody else can see the screen.',
        'Your account role automatically opens the dashboard assigned to you.',
      ],
      features: 'One login page opens the dashboard assigned to your account role. An account can be signed in on one device at a time; if it is already signed in elsewhere, the app asks before signing that device out.',
      note: 'After 10 wrong passwords for the same username, sign-in is locked for 15 minutes and the login page counts down the time left. Never share accounts.',
    },
    tl: {
      title: 'Pag-login', screen: 'Home page at pag-sign in',
      purpose: 'Buksan ang dashboard na para sa trabaho mo sa Javier Permaculture Farm.',
      steps: [
        'Kumonekta sa WiFi ng farm, tapos buksan ang address ng FarmSense Brew na binigay ng System Admin.',
        'Pindutin ang Sign in. Iisa ang login page para sa lahat ng account.',
        'Ilagay ang sarili mong username at password, tapos pindutin ang Login. Gamitin lang ang Show password kung walang ibang nakatingin.',
        'Awtomatikong bubuksan ang dashboard na nakatalaga sa role ng account mo.',
      ],
      features: 'Iisa ang login page; ang role ng account ang batayan ng dashboard na bubuksan. Isang device lang pwedeng naka-login ang isang account; kung naka-login na sa iba, magtatanong muna ang app bago i-logout yung isa.',
      note: 'Pag 10 beses nang mali ang password sa iisang username, naka-lock muna ang login ng 15 minuto at may countdown sa login page. Wag ipahiram ang account.',
    },
    taglish: {
      title: 'Pag-sign in', screen: 'Home page at sign-in',
      purpose: 'Buksan ang dashboard na naka-assign sa work mo sa Javier Permaculture Farm.',
      steps: [
        'Mag-connect sa farm WiFi, tapos i-open ang FarmSense Brew web address na binigay ng System Admin.',
        'Pindutin ang Sign in. Iisa ang login page para sa lahat ng account.',
        'I-type ang sarili mong username at password, tapos i-click ang Login. Gamitin lang ang Show password kung walang ibang nakatingin.',
        'Automatic na bubukas ang dashboard na naka-assign sa role ng account mo.',
      ],
      features: 'Iisa ang login page; ang role ng account ang batayan ng dashboard na bubuksan. Isang device lang pwedeng naka-sign in ang isang account; kung naka-sign in na sa iba, magtatanong muna ang app bago i-sign out yung isa.',
      note: 'After 10 wrong passwords sa iisang username, locked ang sign-in for 15 minutes at may countdown sa login page. Wag i-share ang account.',
    },
  },
  {
    id: 'password',
    shots: ['04-forgot'],
    en: {
      title: 'Forgot your password', screen: 'Request Password Change',
      purpose: 'Ask the System Admin to approve a password change when you cannot sign in.',
      steps: [
        'On the login page, select Forgot password?.',
        'Enter your username, then select Request Change.',
        'Tell the System Admin about the request and wait for approval. Then select Check status.',
        'When it shows approved, enter and confirm your new password, then sign in again.',
      ],
      features: 'Password changes are approved by the System Admin; no reset link is sent by email.',
    },
    tl: {
      title: 'Nakalimutan ang password', screen: 'Request Password Change',
      purpose: 'Humingi ng pahintulot sa System Admin na palitan ang password kapag hindi ka maka-login.',
      steps: [
        'Sa login page, pindutin ang Forgot password?.',
        'Ilagay ang username mo, tapos pindutin ang Request Change.',
        'Sabihan ang System Admin at hintayin ang approval. Tapos pindutin ang Check status.',
        'Pag approved na, ilagay at ulitin ang bagong password, tapos mag-login ulit.',
      ],
      features: 'Ang System Admin ang nag-a-approve ng pagpalit ng password; walang link na ipapadala sa email.',
    },
    taglish: {
      title: 'Forgot password', screen: 'Request Password Change',
      purpose: 'Mag-request sa System Admin na ma-approve ang password change kapag hindi ka maka-sign in.',
      steps: [
        'Sa login page, i-click ang Forgot password?.',
        'I-type ang username mo, tapos i-click ang Request Change.',
        'I-inform ang System Admin at hintayin ang approval. Tapos i-click ang Check status.',
        'Pag approved na, i-type at i-confirm ang new password, tapos mag-sign in ulit.',
      ],
      features: 'System Admin ang nag-a-approve ng password changes; walang reset link na sine-send sa email.',
    },
  },
  {
    id: 'reading-status',
    shots: [],
    en: {
      title: 'Reading the status colours', screen: 'Every dashboard',
      purpose: 'Understand what the risk levels and the grey "offline" colour mean before acting on a reading.',
      steps: [
        'Coffee leaf rust (CLR) risk has five levels: Minimal, Low, Moderate, High and Critical.',
        'Red or orange (High, Critical): do not water that area; inspect the leaves. Amber (Moderate): check again soon. Green or olive (Minimal, Low): routine care.',
        'Grey means the node is offline (not reporting). Its readings show "—" and must not be read as zero.',
        'A sensor fault can affect the air sensor or the soil sensor separately; the other one can still report.',
      ],
      features: 'Valve 1 waters the west side (Nodes 1 and 4), Valve 2 the centre (Node 3) and Valve 3 the east side (Nodes 2 and 5).',
      note: 'A CLR risk level describes weather conditions that favour rust. It is not a confirmed diagnosis of diseased leaves.',
    },
    tl: {
      title: 'Ano ang ibig sabihin ng mga kulay', screen: 'Lahat ng dashboard',
      purpose: 'Intindihin ang mga level ng tsansa ng kalawang at ang grey na "offline" bago kumilos.',
      steps: [
        'Lima ang level ng tsansa ng kalawang (CLR): Okay, Bantayan, Mag-ingat, Mataas at Delikado.',
        'Pula o orange (Mataas, Delikado): wag diligan ang lugar na yun at silipin ang mga dahon. Dilaw (Mag-ingat): balikan ulit mamaya. Berde (Okay, Bantayan): normal na alaga lang.',
        'Grey ibig sabihin offline ang node (walang pinapadala). "—" ang lalabas sa reading nito, at hindi ibig sabihin nun ay zero.',
        'Pwedeng masira ang sensor ng hangin o ang sensor ng lupa nang magkahiwalay; tuloy pa rin ang isa.',
      ],
      features: 'Valve 1 ang dumidilig sa kanluran (Node 1 at 4), Valve 2 sa gitna (Node 3), Valve 3 sa silangan (Node 2 at 5).',
      note: 'Ang level ng CLR ay tungkol sa panahon na gusto ng kalawang. Hindi ibig sabihin na may sakit na talaga ang mga dahon.',
    },
    taglish: {
      title: 'Meaning ng status colors', screen: 'Lahat ng dashboard',
      purpose: 'Intindihin ang risk levels at ang grey na "offline" bago mag-action sa isang reading.',
      steps: [
        'Limang levels ang coffee leaf rust (CLR) risk: Minimal, Low, Moderate, High at Critical.',
        'Red o orange (High, Critical): wag i-water ang area; i-check ang leaves. Amber (Moderate): i-check ulit mamaya. Green o olive (Minimal, Low): regular na alaga lang.',
        'Grey means offline ang node (hindi nagse-send). "—" ang lalabas sa readings nito, at hindi yun zero.',
        'Pwedeng magka-problem ang air sensor o ang soil sensor nang separate; tuloy pa rin ang isa.',
      ],
      features: 'Valve 1 ang nagwa-water sa west (Nodes 1 at 4), Valve 2 sa center (Node 3), Valve 3 sa east (Nodes 2 at 5).',
      note: 'Ang CLR risk level ay tungkol sa weather na gusto ng rust. Hindi ito confirmed na may sakit na ang leaves.',
    },
  },
];

export const CLOSING = [
  {
    id: 'logout',
    shots: ['ad-06-logout'],
    en: {
      title: 'Logging out and getting help', screen: 'Log out',
      purpose: 'End your session and send a problem to the right person.',
      steps: [
        'Select Log out in the sidebar (or the bottom bar on a phone), then confirm Log Out.',
        'Login or account problems: contact the System Admin.',
        'An offline node, a sensor fault or a valve that does not match what you see at the farm: report the node or valve number, the time and what you saw to the Farm Owner or the System Admin.',
        'Plant symptoms or decisions about treatment: contact the agronomist or the Farm Owner.',
      ],
      features: 'Closing the browser tab does not log you out. Log out on shared phones and computers.',
    },
    tl: {
      title: 'Pag-logout at paghingi ng tulong', screen: 'Log out',
      purpose: 'Tapusin ang session mo at ipaalam ang problema sa tamang tao.',
      steps: [
        'Pindutin ang Log out sa gilid (o sa ibaba kung cellphone), tapos pindutin ang Log Out para sigurado.',
        'Problema sa login o account: sabihan ang System Admin.',
        'Offline na node, sirang sensor, o balbulang iba sa nakikita mo sa farm: sabihin ang number ng node o valve, ang oras at ang nakita mo sa Farm Owner o sa System Admin.',
        'Sakit ng halaman o desisyon sa gamot: sa agronomist o sa Farm Owner.',
      ],
      features: 'Hindi ka nalo-logout kapag sinara mo lang ang browser. Mag-logout lagi sa hiram na cellphone o computer.',
    },
    taglish: {
      title: 'Pag-log out at pag-ask ng help', screen: 'Log out',
      purpose: 'I-end ang session mo at i-report ang problem sa tamang tao.',
      steps: [
        'I-click ang Log out sa sidebar (o sa bottom bar kung phone), tapos i-confirm ang Log Out.',
        'Login o account problems: i-contact ang System Admin.',
        'Offline na node, sensor problem, o valve na iba sa nakikita mo sa farm: i-report ang node o valve number, oras at nakita mo sa Farm Owner o System Admin.',
        'Plant symptoms o decisions sa treatment: sa agronomist o sa Farm Owner.',
      ],
      features: 'Hindi ka nala-log out kapag sinara mo lang ang browser tab. Mag-log out lagi sa shared na phone o computer.',
    },
  },
];

// ------------------------------------------------------- reusable screens
const ALERTS_READ = {
  id: 'alerts',
  tab: 'alerts',
  shots: ['ow-04-alerts'],
  en: {
    title: 'Alerts', screen: 'Alerts',
    purpose: 'Follow CLR risk episodes and see what has been done about them.',
    steps: [
      'Open Alerts and read the Open list: node, risk level, message and when it opened.',
      'Check whether an action or a quiet period is already recorded on the alert.',
      'Select History to see closed episodes.',
      'Use Download file as when you need the alerts as a report.',
    ],
    features: 'One open alert per node at a time; it closes when conditions improve. The bell at the top shows how many are open.',
    note: 'This screen is read-only for your role. The agronomist records alert actions here.',
  },
  tl: {
    title: 'Mga Alert', screen: 'Alerts',
    purpose: 'Sundan ang mga babala tungkol sa kalawang at tingnan kung ano na ang nagawa.',
    steps: [
      'Buksan ang Alerts at basahin ang Open: aling node, gaano kataas, ano ang mensahe at kailan nagsimula.',
      'Tingnan kung may naka-record nang ginawa sa alert.',
      'Pindutin ang History para makita ang mga tapos na.',
      'Gamitin ang Download file as kung kailangan ng report.',
    ],
    features: 'Isang bukas na alert lang bawat node; nagsasara ito kapag umayos na ang lagay. Ang kampana sa itaas ang nagsasabi kung ilan ang bukas.',
    note: 'Pang-basa lang ang screen na ito para sa role mo. Ang agronomist ang nagre-record ng aksyon dito.',
  },
  taglish: {
    title: 'Alerts', screen: 'Alerts',
    purpose: 'I-follow ang CLR risk alerts at tingnan kung anong nagawa na.',
    steps: [
      'I-open ang Alerts at basahin ang Open list: node, risk level, message at kailan nag-start.',
      'I-check kung may naka-record nang action sa alert.',
      'I-click ang History para makita ang closed alerts.',
      'Gamitin ang Download file as kung kailangan ng report.',
    ],
    features: 'Isang open alert lang per node; nagko-close ito kapag gumanda na ang conditions. Ang bell sa taas ang nagsasabi kung ilan ang open.',
    note: 'Read-only ang screen na ito para sa role mo. Ang agronomist ang nagre-record ng actions dito.',
  },
};

const IRR_AUTO = {
  id: 'irr-auto',
  tab: 'irrigation',
  shots: ['ag-05-irr-auto'],
  en: {
    title: 'Irrigation: Automatic', screen: 'Irrigation, Automatic tab',
    purpose: 'Check whether automatic watering is on and why each valve is watering or waiting.',
    steps: [
      'Open Irrigation and select Automatic.',
      'Read the reason shown under each valve and the nodes it serves.',
      'Read "How it decides" before turning the automatic switch on or off.',
      'After a change, check the valve status again and ask the field staff to confirm the water at the farm.',
    ],
    features: 'The rules include when the soil needs water, when to stop, the allowed time window, the longest run, a rest period, and a hold at High or Critical risk.',
  },
  tl: {
    title: 'Dilig: Automatic', screen: 'Irrigation, Automatic',
    purpose: 'Tingnan kung bukas ang kusang pagdidilig at kung bakit nagdidilig o naghihintay ang bawat valve.',
    steps: [
      'Buksan ang Irrigation at piliin ang Automatic.',
      'Basahin ang dahilan sa ilalim ng bawat valve at kung aling node ang sakop nito.',
      'Basahin ang "How it decides" bago i-on o i-off ang automatic.',
      'Pagkatapos baguhin, tingnan ulit ang valve at ipa-check sa field staff kung may tubig talaga sa farm.',
    ],
    features: 'Kasama sa patakaran: kailan kailangan ng tubig ang lupa, kailan titigil, anong oras lang pwede, gaano katagal, pahinga, at hindi magdidilig kapag Mataas o Delikado ang tsansa ng kalawang.',
  },
  taglish: {
    title: 'Irrigation: Automatic', screen: 'Irrigation, Automatic tab',
    purpose: 'I-check kung naka-on ang automatic watering at bakit nagwa-water o naghihintay ang bawat valve.',
    steps: [
      'I-open ang Irrigation at piliin ang Automatic.',
      'Basahin ang reason sa ilalim ng bawat valve at kung aling nodes ang sakop.',
      'Basahin ang "How it decides" bago i-on o i-off ang automatic switch.',
      'After mag-change, i-check ulit ang valve status at ipa-confirm sa field staff kung may tubig sa farm.',
    ],
    features: 'Kasama sa rules: kailan kailangan ng water ang soil, kailan titigil, allowed na oras, pinakamatagal na run, rest period, at hold kapag High o Critical ang risk.',
  },
};

const IRR_MANUAL = {
  id: 'irr-manual',
  tab: 'irrigation',
  shots: ['ag-06-irr-manual'],
  en: {
    title: 'Irrigation: Manual', screen: 'Irrigation, Manual tab',
    purpose: 'Open or close one valve from your phone or computer, instead of watering plant by plant.',
    steps: [
      'Open Irrigation and select Manual.',
      'Find the valve by its side of the plot and the nodes it serves.',
      'Use its switch, read the confirmation, and confirm only the action you intend.',
      'Check the new status and confirm at the farm that water is flowing from the drip lines.',
    ],
    features: 'One switch per valve. Manual mode overrides the automatic settings, and only one valve runs at a time, so a valve may wait for another to finish.',
    note: 'Check the risk first: do not water an area whose node is red or orange.',
  },
  tl: {
    title: 'Dilig: Manual', screen: 'Irrigation, Manual',
    purpose: 'Buksan o isara ang isang valve gamit ang cellphone o computer, imbes na isa-isang diligan ang mga puno.',
    steps: [
      'Buksan ang Irrigation at piliin ang Manual.',
      'Hanapin ang valve ayon sa parte ng plot at mga node na sakop nito.',
      'Pindutin ang switch, basahin ang tanong, at i-confirm lang kung yun talaga ang gusto mo.',
      'Tingnan ang bagong lagay at silipin sa farm kung may tumutulong tubig sa drip lines.',
    ],
    features: 'Isang switch bawat valve. Mas nasusunod ang manual kaysa automatic, at isang valve lang ang bukas sa isang pagkakataon kaya minsan maghihintay muna ang isa.',
    note: 'Tingnan muna ang kulay: wag diligan ang lugar na pula o orange ang node.',
  },
  taglish: {
    title: 'Irrigation: Manual', screen: 'Irrigation, Manual tab',
    purpose: 'I-open o i-close ang isang valve gamit ang phone o computer, imbes na isa-isang i-water ang plants.',
    steps: [
      'I-open ang Irrigation at piliin ang Manual.',
      'Hanapin ang valve ayon sa side ng plot at nodes na sakop nito.',
      'I-tap ang switch, basahin ang confirmation, at i-confirm lang kung yun talaga ang gusto mo.',
      'I-check ang new status at i-confirm sa farm na may tubig sa drip lines.',
    ],
    features: 'Isang switch per valve. Mas priority ang manual kaysa automatic settings, at isang valve lang ang tumatakbo at a time kaya minsan maghihintay ang isa.',
    note: 'I-check muna ang risk: wag i-water ang area na red o orange ang node.',
  },
};

const IRR_SCHEDULE = {
  id: 'irr-schedule',
  tab: 'irrigation',
  shots: ['ag-07-irr-schedule', 'ag-08-schedule-form'],
  en: {
    title: 'Irrigation: Schedules', screen: 'Irrigation, Schedule tab',
    purpose: 'Plan watering for a valve at a set time.',
    steps: [
      'Open Irrigation, select Schedule, then select Add.',
      'Choose the valve, the start time and how long it runs (seconds or minutes, up to 30 minutes).',
      'Pick the days of the week or add specific dates, then select Save.',
      'Use Edit or the delete button on a schedule to change or remove it.',
    ],
    features: 'Scheduled watering is skipped while the risk is High or Critical.',
  },
  tl: {
    title: 'Dilig: Schedule', screen: 'Irrigation, Schedule',
    purpose: 'Itakda ang oras ng pagdidilig ng isang valve.',
    steps: [
      'Buksan ang Irrigation, piliin ang Schedule, tapos pindutin ang Add.',
      'Piliin ang valve, anong oras magsisimula at gaano katagal (segundo o minuto, hanggang 30 minuto).',
      'Piliin ang mga araw o maglagay ng petsa, tapos pindutin ang Save.',
      'Gamitin ang Edit o ang basurahan na button para baguhin o tanggalin ang schedule.',
    ],
    features: 'Hindi tuloy ang naka-schedule na dilig kapag Mataas o Delikado ang tsansa ng kalawang.',
  },
  taglish: {
    title: 'Irrigation: Schedules', screen: 'Irrigation, Schedule tab',
    purpose: 'Mag-set ng oras ng watering para sa isang valve.',
    steps: [
      'I-open ang Irrigation, piliin ang Schedule, tapos i-click ang Add.',
      'Piliin ang valve, start time at gaano katagal (seconds o minutes, hanggang 30 minutes).',
      'Piliin ang days of the week o mag-add ng specific dates, tapos i-click ang Save.',
      'Gamitin ang Edit o delete button para i-change o i-remove ang schedule.',
    ],
    features: 'Na-i-skip ang scheduled watering habang High o Critical ang risk.',
  },
};

const ANALYTICS = {
  id: 'analytics',
  tab: 'analytics',
  shots: ['ag-09-analytics'],
  en: {
    title: 'Analytics', screen: 'Analytics',
    purpose: 'Compare readings and trends over time.',
    steps: [
      'Open Analytics and wait for the dashboard to load.',
      'Read the farm figures, the current readings and the trend charts.',
      'If the Grafana dashboard cannot load, the built-in charts appear instead; select Retry Grafana later.',
    ],
    features: 'Your role\'s Grafana dashboard, with built-in charts as a fallback: trends, risk factors and node comparison.',
    note: 'Leaf wetness is estimated from the dew point for the risk calculation; there is no separate leaf-wetness sensor.',
  },
  tl: {
    title: 'Analytics', screen: 'Analytics',
    purpose: 'Ikumpara ang mga reading at ang takbo nila sa paglipas ng panahon.',
    steps: [
      'Buksan ang Analytics at hintaying mag-load.',
      'Basahin ang mga numero ng farm, ang kasalukuyang reading at ang mga chart.',
      'Kung hindi mag-load ang Grafana, lalabas ang sariling chart ng app; pindutin ang Retry Grafana mamaya.',
    ],
    features: 'Grafana dashboard ng role mo, at may sariling chart bilang reserba: trend, mga sanhi ng tsansa ng kalawang, at paghahambing ng mga node.',
    note: 'Tinatantya lang ang basa ng dahon mula sa dew point; walang hiwalay na sensor para dito.',
  },
  taglish: {
    title: 'Analytics', screen: 'Analytics',
    purpose: 'I-compare ang readings at trends over time.',
    steps: [
      'I-open ang Analytics at hintaying mag-load.',
      'Basahin ang farm figures, current readings at trend charts.',
      'Kung hindi mag-load ang Grafana, lalabas ang built-in charts; i-click ang Retry Grafana mamaya.',
    ],
    features: 'Grafana dashboard ng role mo, may built-in charts as backup: trends, risk factors at node comparison.',
    note: 'Estimated lang ang leaf wetness from the dew point; walang separate na leaf-wetness sensor.',
  },
};

const DOWNLOADS = {
  id: 'downloads',
  tab: 'analytics',
  shots: ['ag-10-download'],
  en: {
    title: 'Downloading reports and data', screen: 'Download file as',
    purpose: 'Save readings or alerts as a file.',
    steps: [
      'Select Download file as (in Analytics or Alerts).',
      'Choose PDF, Excel or CSV.',
      'Choose the period: Last 24 hours, Last 7 days, One day, Date range or All time, and all nodes or one node.',
      'Select Download, then open the file and check the dates and nodes.',
    ],
    features: 'PDF is a printable report on the farm letterhead; Excel and CSV are for further analysis.',
  },
  tl: {
    title: 'Pag-download ng report at data', screen: 'Download file as',
    purpose: 'I-save ang mga reading o alert bilang file.',
    steps: [
      'Pindutin ang Download file as (sa Analytics o Alerts).',
      'Piliin kung PDF, Excel o CSV.',
      'Piliin ang panahon: Last 24 hours, Last 7 days, One day, Date range o All time, at kung lahat o isang node lang.',
      'Pindutin ang Download, tapos buksan ang file at tingnan kung tama ang petsa at node.',
    ],
    features: 'Ang PDF ay pang-print na report na naka-letterhead ng farm; ang Excel at CSV ay para sa mas detalyadong pagtingin.',
  },
  taglish: {
    title: 'Pag-download ng reports at data', screen: 'Download file as',
    purpose: 'I-save ang readings o alerts as a file.',
    steps: [
      'I-click ang Download file as (sa Analytics o Alerts).',
      'Piliin ang PDF, Excel o CSV.',
      'Piliin ang period: Last 24 hours, Last 7 days, One day, Date range o All time, at all nodes o isang node.',
      'I-click ang Download, tapos i-open ang file at i-check ang dates at nodes.',
    ],
    features: 'Ang PDF ay printable report sa farm letterhead; ang Excel at CSV ay para sa further analysis.',
  },
};

// ------------------------------------------------------------ hardware (System Admin and Farm Owner)
// How to build a sensor box, set up its post and connect it to the system.
// Asked for by the panel at the final defense (5 Nov 2026).
const HW_BOX = {
  id: 'hw-box',
  shots: ['hw-01-sensor-box', 'hw-02-wiring'],
  en: {
    title: 'Hardware: building a sensor box', screen: 'Sensor box',
    capt: 'Drawing of the installed design (3D model and wiring diagram).',
    purpose: 'Build a new sensor box the same way as the five boxes at the plot, so it works with the system and stays dry.',
    steps: [
      'Parts for one box: ESP32 DevKit (30-pin), LM2596 buck converter (12 V to 5 V), SHT31 probe, capacitive soil moisture sensor v2.0, clear-lid IP65 box (100 x 68 mm) with three cable glands, a silica gel packet and a 2 A inline fuse on its 12 V run.',
      'Set the buck converter to 5 V and measure it with a multimeter BEFORE connecting the ESP32. 12 V or 220 V on the ESP32 destroys it.',
      'Buck converter: 12 V in to IN+ and IN-; OUT+ (5 V) to the ESP32 VIN pin; OUT- to GND.',
      'SHT31 probe: red to 3V3, black to GND, green (SDA) to D21, yellow (SCL) to D22.',
      'Soil probe: AOUT to D34, VCC to D25 (the board switches the probe on only while it reads), GND to GND.',
      'Bring every cable in through a gland on the bottom of the box, tighten the gland and seal it with neutral-cure silicone.',
      'Press the rubber cord into the groove inside the lid all the way round, put a silica gel packet inside and screw the lid down evenly.',
      'Seal the top of the soil probe (the board and connector above the printed line) with conformal coating, then liquid electrical tape.',
    ],
    features: 'Every box is built the same way, so a new box needs no change to the server or the web app.',
    note: 'Do not flash or power a box with the lid off in the rain. Keep spare boxes dry until they are installed.',
  },
  tl: {
    title: 'Hardware: paggawa ng sensor box', screen: 'Sensor box',
    capt: 'Drawing ng naka-install na disenyo (3D model at wiring diagram).',
    purpose: 'Gumawa ng bagong sensor box na kapareho ng limang box sa plot, para gumana sa system at hindi pasukin ng tubig.',
    steps: [
      'Piyesa ng isang box: ESP32 DevKit (30-pin), LM2596 buck converter (12 V papuntang 5 V), SHT31 probe, capacitive soil moisture sensor v2.0, IP65 na kahon na may malinaw na takip (100 x 68 mm) na may tatlong cable gland, isang silica gel at 2 A na fuse sa 12 V na linya nito.',
      'I-set sa 5 V ang buck converter at sukatin gamit ang multimeter BAGO ikabit ang ESP32. Masisira ang ESP32 kapag 12 V o 220 V ang pumasok.',
      'Buck converter: 12 V papasok sa IN+ at IN-; OUT+ (5 V) sa VIN ng ESP32; OUT- sa GND.',
      'SHT31 probe: pula sa 3V3, itim sa GND, berde (SDA) sa D21, dilaw (SCL) sa D22.',
      'Soil probe: AOUT sa D34, VCC sa D25 (binubuksan lang ng board ang probe habang nagbabasa), GND sa GND.',
      'Ipasok ang bawat kable sa gland sa ilalim ng kahon, higpitan ang gland at lagyan ng neutral-cure na silicone.',
      'Idiin ang rubber na tali sa uka sa loob ng takip nang buong ikot, maglagay ng silica gel sa loob at i-turnilyo nang pantay ang takip.',
      'Takpan ang itaas ng soil probe (ang board at connector sa itaas ng guhit) ng conformal coating, tapos ng liquid electrical tape.',
    ],
    features: 'Pare-pareho ang paggawa ng bawat box, kaya walang kailangang baguhin sa server o sa web app para sa bagong box.',
    note: 'Huwag i-flash o paandarin ang box nang bukas ang takip habang umuulan. Itago nang tuyo ang mga ekstrang box hanggang ikabit.',
  },
  taglish: {
    title: 'Hardware: pag-build ng sensor box', screen: 'Sensor box',
    capt: 'Drawing ng installed na design (3D model at wiring diagram).',
    purpose: 'Mag-build ng bagong sensor box na same sa limang box sa plot, para gumana sa system at hindi mabasa.',
    steps: [
      'Parts ng isang box: ESP32 DevKit (30-pin), LM2596 buck converter (12 V to 5 V), SHT31 probe, capacitive soil moisture sensor v2.0, clear-lid IP65 box (100 x 68 mm) na may tatlong cable glands, isang silica gel at 2 A inline fuse sa 12 V run nito.',
      'I-set sa 5 V ang buck converter at i-check gamit ang multimeter BEFORE ikabit ang ESP32. Masisira ang ESP32 kapag 12 V o 220 V ang pumasok.',
      'Buck converter: 12 V in sa IN+ at IN-; OUT+ (5 V) sa VIN ng ESP32; OUT- sa GND.',
      'SHT31 probe: red sa 3V3, black sa GND, green (SDA) sa D21, yellow (SCL) sa D22.',
      'Soil probe: AOUT sa D34, VCC sa D25 (ino-on lang ng board ang probe habang nagre-read), GND sa GND.',
      'Ipasok ang bawat cable sa gland sa bottom ng box, higpitan ang gland at i-seal ng neutral-cure silicone.',
      'I-press ang rubber cord sa groove sa loob ng lid nang buong ikot, maglagay ng silica gel sa loob at i-screw nang pantay ang lid.',
      'I-seal ang top ng soil probe (board at connector above the printed line) ng conformal coating, tapos liquid electrical tape.',
    ],
    features: 'Same ang build ng bawat box, kaya walang babaguhin sa server o web app para sa new box.',
    note: 'Huwag i-flash o i-power ang box nang open ang lid habang umuulan. Keep dry ang spare boxes hanggang ma-install.',
  },
};

const HW_POST = {
  id: 'hw-post',
  shots: ['hw-03-post'],
  en: {
    title: 'Hardware: setting up the post at the plot', screen: 'Sensor post',
    capt: 'Drawing of the installed design (3D model).',
    purpose: 'Mount a sensor box on its post so the air and soil readings match the other nodes.',
    steps: [
      'Use a bamboo post about 2 m long, buried about 50 cm, at the spot planned for the node.',
      'Fix the sensor box to the post about 45 cm above the ground with its cable holes facing down, and leave a drip loop in each cable.',
      'Hang the SHT31 probe inside the upside-down white plant pot at the end of the PVC arm, so sun and rain cannot reach it but air can.',
      'Push the soil probe into the root zone of the nearest coffee plant, about 25 cm from the post, only down to its printed line.',
      'Run the 12 V cable from its own fused output in the power box. Check the polarity at the post before plugging the box in.',
    ],
    features: 'Shade and the distance to the plant change the readings, so place a new post like the existing ones.',
    note: 'Never bring 220 V to the plot. Only the power box turns 220 V into 12 V.',
  },
  tl: {
    title: 'Hardware: pagkabit ng poste sa plot', screen: 'Sensor post',
    capt: 'Drawing ng naka-install na disenyo (3D model).',
    purpose: 'Ikabit ang sensor box sa poste para tumugma ang reading ng hangin at lupa sa ibang node.',
    steps: [
      'Gumamit ng kawayan na mga 2 m ang haba, nakabaon nang mga 50 cm, sa puwestong plinano para sa node.',
      'Ikabit ang sensor box sa poste mga 45 cm mula sa lupa, nakaharap pababa ang butas ng kable, at mag-iwan ng drip loop sa bawat kable.',
      'Isabit ang SHT31 sa loob ng nakataob na puting paso sa dulo ng PVC na braso, para hindi maarawan o maulanan pero may hangin.',
      'Ibaon ang soil probe sa ugat ng pinakamalapit na kape, mga 25 cm mula sa poste, hanggang sa guhit lang nito.',
      'Kunin ang 12 V na kable sa sarili nitong fuse sa power box. Tingnan ang polarity sa poste bago isaksak ang box.',
    ],
    features: 'Nagbabago ang reading depende sa lilim at layo sa halaman, kaya ilagay ang bagong poste katulad ng mga nauna.',
    note: 'Huwag magdala ng 220 V sa plot. Ang power box lang ang nagpapalit ng 220 V papuntang 12 V.',
  },
  taglish: {
    title: 'Hardware: pag-setup ng post sa plot', screen: 'Sensor post',
    capt: 'Drawing ng installed na design (3D model).',
    purpose: 'I-mount ang sensor box sa post para mag-match ang air at soil readings sa ibang nodes.',
    steps: [
      'Gumamit ng bamboo post na mga 2 m ang haba, nakabaon nang mga 50 cm, sa spot na planned para sa node.',
      'I-fix ang sensor box sa post mga 45 cm above the ground, facing down ang cable holes, at mag-iwan ng drip loop sa bawat cable.',
      'Isabit ang SHT31 probe sa loob ng upside-down na white plant pot sa dulo ng PVC arm, para walang araw at ulan pero may hangin.',
      'Ibaon ang soil probe sa root zone ng pinakamalapit na coffee plant, mga 25 cm from the post, hanggang printed line lang.',
      'Kunin ang 12 V cable sa sarili nitong fused output sa power box. I-check ang polarity sa post bago i-plug ang box.',
    ],
    features: 'Nagbabago ang readings depende sa shade at layo sa plant, kaya ilagay ang new post like the existing ones.',
    note: 'Huwag magdala ng 220 V sa plot. Ang power box lang ang nagco-convert ng 220 V to 12 V.',
  },
};

const HW_CONNECT = {
  id: 'hw-connect',
  tab: 'boxes',
  shots: ['ad-03-boxes'],
  en: {
    title: 'Hardware: connecting a new box to the system', screen: 'Sensor Boxes',
    purpose: 'Get a new sensor box to sign on, receive its node number and appear in every role\'s view.',
    steps: [
      'Farm Owner: add the node first with Expand coverage, so a free node is waiting for the box.',
      'Flash the field-node firmware to the ESP32 with the Arduino IDE, with the farm Wi-Fi name and password in config.h and NODE_ID left at 0 (automatic).',
      'Power the box from its fused 12 V run. It joins the farm Wi-Fi of the Globe router and looks for the server (jpcf.local).',
      'The server gives the board the lowest free node and its own key. The board blinks its node number slowly once it has signed on.',
      'System Admin: open Sensor Boxes and check that the board ID now shows under Registered boxes with the right node and a recent Last seen.',
      'Check the node on the Overview: it turns from offline to live within a few seconds of its first reading.',
    ],
    features: 'A board is accepted only while a node is free, and every registration is written to the Audit Log.',
    note: 'If the board never blinks its number, check the 5 V supply, the Wi-Fi name and password in the firmware, and that a free node exists.',
  },
  tl: {
    title: 'Hardware: pagkonekta ng bagong box sa system', screen: 'Sensor Boxes',
    purpose: 'Para makapag-sign on ang bagong sensor box, makatanggap ng number ng node at lumabas sa view ng bawat role.',
    steps: [
      'Farm Owner: idagdag muna ang node gamit ang Expand coverage, para may bakanteng node na naghihintay sa box.',
      'I-flash ang field-node firmware sa ESP32 gamit ang Arduino IDE, nakalagay ang pangalan at password ng Wi-Fi ng farm sa config.h at 0 (automatic) ang NODE_ID.',
      'Paandarin ang box mula sa 12 V na linya nitong may fuse. Kokonekta ito sa Wi-Fi ng Globe router at hahanapin ang server (jpcf.local).',
      'Ibibigay ng server sa board ang pinakamababang bakanteng node at sariling key. Dahan-dahang kikislap ng number ng node ang board kapag naka-sign on na.',
      'System Admin: buksan ang Sensor Boxes at tingnan kung nasa Registered boxes na ang board ID, tama ang node at bago ang Last seen.',
      'Tingnan ang node sa Overview: magiging live ito ilang segundo matapos ang unang reading.',
    ],
    features: 'Tumatanggap lang ng board kapag may bakanteng node, at naitatala sa Audit Log ang bawat pag-register.',
    note: 'Kung hindi kumikislap ang number, tingnan ang 5 V, ang pangalan at password ng Wi-Fi sa firmware, at kung may bakanteng node.',
  },
  taglish: {
    title: 'Hardware: pag-connect ng new box sa system', screen: 'Sensor Boxes',
    purpose: 'Para mag-sign on ang new sensor box, makakuha ng node number at lumabas sa view ng bawat role.',
    steps: [
      'Farm Owner: i-add muna ang node gamit ang Expand coverage, para may free node na naghihintay sa box.',
      'I-flash ang field-node firmware sa ESP32 gamit ang Arduino IDE, nakalagay ang farm Wi-Fi name at password sa config.h at 0 (automatic) ang NODE_ID.',
      'I-power ang box mula sa fused 12 V run nito. Magco-connect ito sa farm Wi-Fi ng Globe router at hahanapin ang server (jpcf.local).',
      'Ibibigay ng server sa board ang lowest free node at sariling key. Dahan-dahang magbli-blink ng node number ang board kapag naka-sign on na.',
      'System Admin: i-open ang Sensor Boxes at i-check kung nasa Registered boxes na ang board ID, tama ang node at recent ang Last seen.',
      'I-check ang node sa Overview: magiging live ito ilang seconds after ng first reading.',
    ],
    features: 'Tumatanggap lang ng board kapag may free node, at naka-record sa Audit Log ang bawat registration.',
    note: 'Kung hindi nagbli-blink ang number, i-check ang 5 V, ang Wi-Fi name at password sa firmware, at kung may free node.',
  },
};

// ------------------------------------------------------------ per role
export const ROLE_SECTIONS = {
  agronomist: [
    {
      id: 'overview',
      tab: 'dashboard',
      shots: ['ag-01-overview', 'ag-02-overview-lower'],
      en: {
        title: 'Overview', screen: 'Agronomist Overview',
        purpose: 'Review readings and risk, and find the nodes that need inspection.',
        steps: [
          'Check how many nodes are online before reading the averages.',
          'Select a node on CLR Risk Score by Node to see its live readings.',
          'Read Coffee Leaf Rust Risk Analysis for what is driving the risk.',
          'Scroll to Current Node Overview and Environmental Trend (24h) to compare nodes.',
        ],
        features: 'Environment averages, the plot photo map with the status of each node, live readings per node and the 24-hour trend.',
      },
      tl: {
        title: 'Overview', screen: 'Overview ng Agronomist',
        purpose: 'Tingnan ang mga reading at tsansa ng kalawang, at hanapin ang node na kailangang silipin.',
        steps: [
          'Tingnan muna kung ilang node ang online bago basahin ang average.',
          'Pumili ng node sa CLR Risk Score by Node para makita ang live na reading.',
          'Basahin ang Coffee Leaf Rust Risk Analysis para malaman kung ano ang nagpapataas ng tsansa.',
          'Mag-scroll sa Current Node Overview at Environmental Trend (24h) para ikumpara ang mga node.',
        ],
        features: 'Average ng panahon, mapa ng larawan ng taniman na may lagay ng bawat node, live na reading bawat node at trend sa loob ng 24 oras.',
      },
      taglish: {
        title: 'Overview', screen: 'Agronomist Overview',
        purpose: 'I-review ang readings at risk, at hanapin ang nodes na kailangang i-inspect.',
        steps: [
          'I-check kung ilang nodes ang online bago basahin ang averages.',
          'Pumili ng node sa CLR Risk Score by Node para makita ang live readings.',
          'Basahin ang Coffee Leaf Rust Risk Analysis para malaman kung anong nagpapataas ng risk.',
          'Mag-scroll sa Current Node Overview at Environmental Trend (24h) para i-compare ang nodes.',
        ],
        features: 'Environment averages, plot photo map na may status ng bawat node, live readings per node at 24-hour trend.',
      },
    },
    {
      id: 'alerts',
      tab: 'alerts',
      shots: ['ag-03-alerts', 'ag-04-record-action'],
      en: {
        title: 'Alerts and recording actions', screen: 'Alerts',
        purpose: 'Read risk episodes and record what was done after it was actually done.',
        steps: [
          'Open Alerts and choose Open or History.',
          'Read the node, risk level, message and timing.',
          'After the field work is finished, select Record action on that alert and describe what was done.',
          'Use Refresh to reload, or Download file as to export alerts.',
        ],
        features: 'Only the agronomist records actions on alerts. An alert with no action after 12 hours shows a reminder.',
        note: 'An old opening date can belong to an episode that is still going. Check the node\'s current status before deciding.',
      },
      tl: {
        title: 'Mga alert at pag-record ng aksyon', screen: 'Alerts',
        purpose: 'Basahin ang mga babala at i-record ang ginawa kapag tapos na talaga.',
        steps: [
          'Buksan ang Alerts at piliin ang Open o History.',
          'Basahin ang node, level, mensahe at oras.',
          'Kapag tapos na ang trabaho sa farm, pindutin ang Record action sa alert at isulat ang ginawa.',
          'Pindutin ang Refresh para mag-reload, o Download file as para i-export.',
        ],
        features: 'Agronomist lang ang nagre-record ng aksyon sa alert. Kapag 12 oras na at walang aksyon, may lalabas na paalala.',
        note: 'Pwedeng luma ang petsa ng simula pero tuloy pa rin ang babala. Tingnan muna ang kasalukuyang lagay ng node bago magdesisyon.',
      },
      taglish: {
        title: 'Alerts at pag-record ng actions', screen: 'Alerts',
        purpose: 'Basahin ang risk alerts at i-record ang ginawa after talagang nagawa.',
        steps: [
          'I-open ang Alerts at piliin ang Open o History.',
          'Basahin ang node, risk level, message at timing.',
          'After matapos ang field work, i-click ang Record action sa alert at i-describe ang ginawa.',
          'I-click ang Refresh para mag-reload, o Download file as para i-export.',
        ],
        features: 'Agronomist lang ang nagre-record ng actions sa alerts. Kapag 12 hours na walang action, may reminder.',
        note: 'Pwedeng luma ang opening date pero tuloy pa ang alert. I-check muna ang current status ng node bago mag-decide.',
      },
    },
    IRR_AUTO,
    IRR_MANUAL,
    IRR_SCHEDULE,
    ANALYTICS,
    DOWNLOADS,
  ],

  farm_owner: [
    {
      id: 'overview',
      tab: 'dashboard',
      shots: ['ow-01-overview', 'ow-02-overview-lower'],
      en: {
        title: 'Overview', screen: 'Farm Owner Overview',
        purpose: 'See the farm\'s condition, the recommendations, recent field work and whether the system is running.',
        steps: [
          'Check the average CLR risk and the number of nodes online.',
          'Read Recommendations; switch between English, Tagalog and Taglish if needed.',
          'Scroll to the 7-Day Environmental Trend, CLR Risk Score by Node, Irrigation, System Health and Recent field actions.',
          'Select PDF report for a printable summary.',
        ],
        features: 'Recommendations are written by Gemini AI when the internet is available, otherwise by the built-in rules; the label on the panel says which.',
      },
      tl: {
        title: 'Overview', screen: 'Overview ng Farm Owner',
        purpose: 'Makita ang lagay ng farm, ang mga payo, ang mga nagawa ng staff at kung tumatakbo ang system.',
        steps: [
          'Tingnan ang average na tsansa ng kalawang at kung ilang node ang online.',
          'Basahin ang Recommendations; pwedeng palitan sa English, Tagalog o Taglish.',
          'Mag-scroll sa 7-Day Environmental Trend, CLR Risk Score by Node, Irrigation, System Health at Recent field actions.',
          'Pindutin ang PDF report para sa buod na pwedeng i-print.',
        ],
        features: 'Gemini AI ang sumusulat ng payo kapag may internet; kung wala, ang sariling patakaran ng system. Nakasulat sa panel kung alin.',
      },
      taglish: {
        title: 'Overview', screen: 'Farm Owner Overview',
        purpose: 'Makita ang condition ng farm, recommendations, recent field work at kung running ang system.',
        steps: [
          'I-check ang average CLR risk at ilang nodes ang online.',
          'Basahin ang Recommendations; pwedeng i-switch sa English, Tagalog o Taglish.',
          'Mag-scroll sa 7-Day Environmental Trend, CLR Risk Score by Node, Irrigation, System Health at Recent field actions.',
          'I-click ang PDF report para sa printable summary.',
        ],
        features: 'Gemini AI ang gumagawa ng recommendations kapag may internet, kung wala ay built-in rules; nakalagay sa panel kung alin.',
      },
    },
    {
      id: 'expand',
      tab: 'dashboard',
      shots: ['ow-03-expand'],
      en: {
        title: 'Expanding coverage (adding a node)', screen: 'Expand coverage',
        purpose: 'Add a node record when a new sensor station has been planned.',
        steps: [
          'On Overview, select Expand coverage.',
          'Review the current node count and the coverage estimate, then enter a clear node name.',
          'Select Add node only after the installation has been agreed.',
          'Ask the System Admin to register the new sensor box. The node stays offline until its box reports.',
        ],
        features: 'Adding nodes is for the Farm Owner only.',
      },
      tl: {
        title: 'Pagdagdag ng node', screen: 'Expand coverage',
        purpose: 'Magdagdag ng bagong node kapag may planong bagong sensor station.',
        steps: [
          'Sa Overview, pindutin ang Expand coverage.',
          'Tingnan ang bilang ng node at ang tantyang sakop, tapos maglagay ng malinaw na pangalan.',
          'Pindutin lang ang Add node kapag napagkasunduan na ang pagkabit.',
          'Ipa-register sa System Admin ang bagong sensor box. Offline muna ang node hangga\'t wala pang reading ang box.',
        ],
        features: 'Farm Owner lang ang pwedeng magdagdag ng node.',
      },
      taglish: {
        title: 'Expand coverage (pag-add ng node)', screen: 'Expand coverage',
        purpose: 'Mag-add ng node kapag may planned na bagong sensor station.',
        steps: [
          'Sa Overview, i-click ang Expand coverage.',
          'I-review ang node count at coverage estimate, tapos mag-type ng malinaw na node name.',
          'I-click lang ang Add node kapag agreed na ang installation.',
          'Ipa-register sa System Admin ang bagong sensor box. Offline muna ang node hanggang mag-report ang box.',
        ],
        features: 'Farm Owner lang ang pwedeng mag-add ng nodes.',
      },
    },
    HW_BOX,
    HW_POST,
    HW_CONNECT,
    {
      ...ALERTS_READ,
      en: { ...ALERTS_READ.en, note: 'Read-only for the Farm Owner. Recent field actions on the Overview show what the staff recorded.' },
      tl: { ...ALERTS_READ.tl, note: 'Pang-basa lang ito para sa Farm Owner. Sa Recent field actions sa Overview makikita ang ni-record ng staff.' },
      taglish: { ...ALERTS_READ.taglish, note: 'Read-only para sa Farm Owner. Sa Recent field actions sa Overview makikita ang ni-record ng staff.' },
    },
    IRR_AUTO,
    IRR_MANUAL,
    IRR_SCHEDULE,
    ANALYTICS,
    DOWNLOADS,
  ],

  field_staff: [
    {
      id: 'overview',
      tab: 'dashboard',
      shots: ['st-01-overview'],
      en: {
        title: 'Overview', screen: 'Field Staff Overview',
        purpose: 'Find the node that needs attention and read what to do there.',
        steps: [
          'Choose your language at the top: Tagalog, Taglish or English.',
          'Tap a numbered balloon on the plot photo map; each balloon sits beside its post.',
          'Read its status, its readings and what to do. Check the time of the last reading.',
          'All Nodes: Quick View lists every node at once.',
        ],
        features: 'Red or orange: do not water, inspect the leaves. Amber: check again soon. Green or olive: routine care. Purple: one sensor of the box is not reading. Grey: the node is offline; check its power and Wi-Fi.',
        note: 'If a node stays grey, tell the Farm Owner or the System Admin.',
      },
      tl: {
        title: 'Overview', screen: 'Overview ng Field Staff',
        purpose: 'Hanapin ang node na kailangang asikasuhin at basahin kung ano ang gagawin doon.',
        steps: [
          'Piliin ang wika sa itaas: Tagalog, Taglish o English.',
          'Pindutin ang may numerong bilog sa mapa ng larawan ng taniman; nasa tabi ito ng poste ng node.',
          'Basahin ang lagay, ang reading at kung ano ang gagawin. Tingnan kung kailan ang huling reading.',
          'Sa Lahat ng Node: Mabilisang Silip, kita mo lahat ng node nang sabay.',
        ],
        features: 'Pula o orange: wag diligan, silipin ang dahon. Dilaw: balikan ulit mamaya. Berde: normal na alaga. Lila: may sensor ng box na hindi nagbabasa. Grey: offline ang node, tingnan ang kuryente at WiFi.',
        note: 'Kung grey pa rin ang node, sabihan ang Farm Owner o ang System Admin.',
      },
      taglish: {
        title: 'Overview', screen: 'Field Staff Overview',
        purpose: 'Hanapin ang node na kailangan ng attention at basahin kung anong gagawin.',
        steps: [
          'Piliin ang language sa taas: Tagalog, Taglish o English.',
          'I-tap ang numbered balloon sa plot photo map; nasa tabi ito ng post ng node.',
          'Basahin ang status, readings at kung anong gagawin. I-check kung kailan ang last reading.',
          'Sa All Nodes: Quick View, kita lahat ng nodes at once.',
        ],
        features: 'Red o orange: wag i-water, i-check ang leaves. Amber: i-check ulit mamaya. Green o olive: regular na alaga. Purple: may sensor ng box na hindi nagre-read. Grey: offline ang node, i-check ang power at WiFi.',
        note: 'Kung grey pa rin ang node, i-contact ang Farm Owner o ang System Admin.',
      },
    },
    {
      id: 'record',
      tab: 'dashboard',
      shots: ['st-02-record'],
      en: {
        title: 'Recording completed work', screen: 'Record what you did',
        purpose: 'Keep a record of the work you actually did at a node.',
        steps: [
          'Tap the node on the Overview, then choose Record what you did (I-record ang ginawa mo).',
          'Choose the action that matches the work. Use Other if none fits.',
          'Write a short note: what you saw and what you did.',
          'Select Save, or Cancel to leave without saving.',
        ],
        features: 'The record is linked to the node and to its alert if there is one. The Farm Owner sees it under Recent field actions.',
        note: 'Record only work that was really done.',
      },
      tl: {
        title: 'Pag-record ng nagawa', screen: 'I-record ang ginawa mo',
        purpose: 'Itala ang trabahong talagang ginawa mo sa isang node.',
        steps: [
          'Pindutin ang node sa Overview, tapos ang I-record ang ginawa mo.',
          'Piliin ang tugma sa ginawa mo. Kung wala, piliin ang Iba pa.',
          'Magsulat ng maikling tala: ano ang nakita mo at ano ang ginawa mo.',
          'Pindutin ang I-save, o Wag na kung ayaw mong i-save.',
        ],
        features: 'Nakakabit ang tala sa node at sa alert kung meron. Makikita ito ng Farm Owner sa Recent field actions.',
        note: 'I-record lang ang talagang nagawa.',
      },
      taglish: {
        title: 'Pag-record ng ginawa', screen: 'I-record ang ginawa mo',
        purpose: 'I-record ang work na talagang ginawa mo sa isang node.',
        steps: [
          'I-tap ang node sa Overview, tapos ang I-record ang ginawa mo.',
          'Piliin ang action na match sa ginawa mo. Kung wala, Iba pa.',
          'Mag-type ng short note: anong nakita mo at anong ginawa mo.',
          'I-click ang I-save, o Wag na kung ayaw i-save.',
        ],
        features: 'Naka-link ang record sa node at sa alert kung meron. Makikita ito ng Farm Owner sa Recent field actions.',
        note: 'I-record lang ang talagang nagawa.',
      },
    },
    {
      ...IRR_AUTO,
      shots: ['st-03-irrigation'],
      en: { ...IRR_AUTO.en, steps: IRR_AUTO.en.steps.slice(0, 2).concat('Compare the screen with the farm. If water flows while a valve shows OFF, report it to the Farm Owner at once.'),
        features: 'The automatic on/off switch and its rules are set by the agronomist and the Farm Owner. You water with the Manual and Schedule tabs.' },
      tl: { ...IRR_AUTO.tl, steps: IRR_AUTO.tl.steps.slice(0, 2).concat('Ikumpara ang screen sa farm. Kung may tubig pero OFF ang valve sa screen, sabihan agad ang Farm Owner.'),
        features: 'Ang agronomist at Farm Owner ang nag-o-on/off ng automatic at nagtatakda ng patakaran. Ikaw ay nagdidilig gamit ang Manual at Schedule.' },
      taglish: { ...IRR_AUTO.taglish, steps: IRR_AUTO.taglish.steps.slice(0, 2).concat('I-compare ang screen sa farm. Kung may tubig pero OFF ang valve, i-report agad sa Farm Owner.'),
        features: 'Ang agronomist at Farm Owner ang nag-o-on/off ng automatic at nagse-set ng rules. Ikaw ay nagwa-water gamit ang Manual at Schedule tabs.' },
    },
    { ...IRR_MANUAL, shots: ['st-05-irr-manual'] },
    { ...IRR_SCHEDULE, shots: ['st-06-irr-schedule', 'ag-08-schedule-form'] },
    { ...ALERTS_READ, shots: ['st-04-alerts'] },
  ],

  admin: [
    {
      id: 'overview',
      tab: 'dashboard',
      shots: ['ad-01-overview'],
      en: {
        title: 'Overview: user accounts', screen: 'Admin Overview',
        purpose: 'Manage who can use the system and with which role.',
        steps: [
          'Review the account counts and the user table (name, username, role, access).',
          'Use the search box or the role filters to find an account.',
          'Use the edit button to change an account. Leave the password blank when editing to keep the current one.',
          'Use the access button to revoke or restore access. Delete an account only when it will never be used again.',
        ],
        features: 'Every account change is written to the Audit Log. Pending password change requests appear above the table; confirm with the person, then approve or reject.',
      },
      tl: {
        title: 'Overview: mga account', screen: 'Overview ng Admin',
        purpose: 'Asikasuhin kung sino ang pwedeng gumamit ng system at anong role nila.',
        steps: [
          'Tingnan ang bilang ng account at ang listahan (pangalan, username, role, access).',
          'Gamitin ang search o ang filter ng role para hanapin ang account.',
          'Gamitin ang edit para baguhin ang account. Iwanang blangko ang password kung ayaw itong palitan.',
          'Gamitin ang access button para tanggalan o ibalik ang access. Burahin lang ang account kung hindi na talaga gagamitin.',
        ],
        features: 'Naitatala sa Audit Log ang bawat pagbago ng account. Lumalabas sa itaas ng listahan ang mga password request; kumpirmahin sa tao bago i-approve o i-reject.',
      },
      taglish: {
        title: 'Overview: user accounts', screen: 'Admin Overview',
        purpose: 'I-manage kung sino ang pwedeng gumamit ng system at anong role.',
        steps: [
          'I-review ang account counts at user table (name, username, role, access).',
          'Gamitin ang search o role filters para hanapin ang account.',
          'Gamitin ang edit button para i-change ang account. Iwanang blank ang password kapag ayaw palitan.',
          'Gamitin ang access button para i-revoke o i-restore ang access. I-delete lang kung hindi na talaga gagamitin.',
        ],
        features: 'Naka-log sa Audit Log ang bawat account change. Lumalabas sa taas ng table ang pending password requests; i-confirm sa tao bago i-approve o i-reject.',
      },
    },
    {
      id: 'add-user',
      tab: 'dashboard',
      shots: ['ad-02-add-user'],
      en: {
        title: 'Adding a user', screen: 'Add User',
        purpose: 'Create an account for a person who needs the system.',
        steps: [
          'On Overview, select Add User.',
          'Enter the full name and username, and choose the role that matches the person\'s work.',
          'Set a starting password and give it to the person privately.',
          'Select Create User. The person should change the password after signing in.',
        ],
        features: 'Roles: Admin, Agronomist, Farm Owner and Field Staff. The role decides which dashboard and actions the account gets.',
      },
      tl: {
        title: 'Pagdagdag ng user', screen: 'Add User',
        purpose: 'Gumawa ng account para sa taong kailangang gumamit ng system.',
        steps: [
          'Sa Overview, pindutin ang Add User.',
          'Ilagay ang buong pangalan at username, at piliin ang role na tugma sa trabaho niya.',
          'Maglagay ng panimulang password at ibigay ito nang pribado.',
          'Pindutin ang Create User. Dapat palitan niya ang password pagka-login.',
        ],
        features: 'Mga role: Admin, Agronomist, Farm Owner at Field Staff. Ang role ang nagtatakda kung anong dashboard at gawain ang meron ang account.',
      },
      taglish: {
        title: 'Pag-add ng user', screen: 'Add User',
        purpose: 'Gumawa ng account para sa taong kailangan ang system.',
        steps: [
          'Sa Overview, i-click ang Add User.',
          'I-type ang full name at username, at piliin ang role na match sa work niya.',
          'Mag-set ng starting password at ibigay ito privately.',
          'I-click ang Create User. Dapat i-change niya ang password after mag-sign in.',
        ],
        features: 'Roles: Admin, Agronomist, Farm Owner at Field Staff. Ang role ang nagde-decide kung anong dashboard at actions ang meron ang account.',
      },
    },
    {
      id: 'boxes',
      tab: 'boxes',
      shots: ['ad-03-boxes'],
      en: {
        title: 'Sensor Boxes', screen: 'Sensor Boxes',
        purpose: 'Check which ESP32 board is assigned to each node and to the valve box.',
        steps: [
          'Open Sensor Boxes and review Registered boxes: node, board ID, last seen and firmware.',
          'Match the node number and board ID before touching a device.',
          'Nodes without a box lists nodes waiting for hardware; How a new box joins explains registration.',
          'Use New key, Release or Remove node only as part of planned maintenance.',
        ],
        features: 'A new box is accepted only while a node is free. Each change is audit-logged.',
        note: 'Release and New key can disconnect a working box until it signs on again.',
      },
      tl: {
        title: 'Mga Sensor Box', screen: 'Sensor Boxes',
        purpose: 'Tingnan kung aling ESP32 board ang nakatalaga sa bawat node at sa valve box.',
        steps: [
          'Buksan ang Sensor Boxes at tingnan ang Registered boxes: node, board ID, huling kita at firmware.',
          'Itugma ang number ng node at board ID bago galawin ang device.',
          'Nasa Nodes without a box ang mga node na wala pang hardware; nasa How a new box joins kung paano mag-register.',
          'Gamitin lang ang New key, Release o Remove node kapag planado ang maintenance.',
        ],
        features: 'Tumatanggap lang ng bagong box kapag may bakanteng node. Naitatala ang bawat pagbabago.',
        note: 'Pwedeng mawala sa koneksyon ang gumaganang box kapag ginamit ang Release o New key, hanggang mag-sign on ulit.',
      },
      taglish: {
        title: 'Sensor Boxes', screen: 'Sensor Boxes',
        purpose: 'I-check kung aling ESP32 board ang naka-assign sa bawat node at sa valve box.',
        steps: [
          'I-open ang Sensor Boxes at i-review ang Registered boxes: node, board ID, last seen at firmware.',
          'I-match ang node number at board ID bago galawin ang device.',
          'Nasa Nodes without a box ang nodes na waiting sa hardware; nasa How a new box joins ang registration.',
          'Gamitin lang ang New key, Release o Remove node kapag planned maintenance.',
        ],
        features: 'Tumatanggap lang ng new box kapag may free na node. Naka-audit log ang bawat change.',
        note: 'Pwedeng ma-disconnect ang working box kapag ginamit ang Release o New key, hanggang mag-sign on ulit.',
      },
    },
    HW_BOX,
    HW_POST,
    HW_CONNECT,
    {
      id: 'audit',
      tab: 'audit',
      shots: ['ad-04-audit'],
      en: {
        title: 'Audit Log', screen: 'Audit Log',
        purpose: 'Review sign-ins, account changes, exports and device maintenance.',
        steps: [
          'Open Audit Log and choose a filter, or All.',
          'Read the account, action and time together. Select Refresh for recent events.',
          'Use Audit CSV or Users CSV when a file is needed, and keep it private.',
        ],
        features: 'Every sign-in, sign-out, account change, export and box change is recorded.',
      },
      tl: {
        title: 'Audit Log', screen: 'Audit Log',
        purpose: 'Tingnan ang mga login, pagbago ng account, export at maintenance ng device.',
        steps: [
          'Buksan ang Audit Log at pumili ng filter, o All.',
          'Basahin nang sabay ang account, aksyon at oras. Pindutin ang Refresh para sa bago.',
          'Gamitin ang Audit CSV o Users CSV kung kailangan ng file, at ingatan ito.',
        ],
        features: 'Naitatala ang bawat login, logout, pagbago ng account, export at pagbago ng box.',
      },
      taglish: {
        title: 'Audit Log', screen: 'Audit Log',
        purpose: 'I-review ang sign-ins, account changes, exports at device maintenance.',
        steps: [
          'I-open ang Audit Log at pumili ng filter, o All.',
          'Basahin together ang account, action at time. I-click ang Refresh para sa recent events.',
          'Gamitin ang Audit CSV o Users CSV kung kailangan ng file, at i-keep itong private.',
        ],
        features: 'Naka-record ang bawat sign-in, sign-out, account change, export at box change.',
      },
    },
    {
      id: 'server',
      tab: 'server',
      shots: ['ad-05-server'],
      en: {
        title: 'Raspberry Pi 4 Server', screen: 'Raspberry Pi 4 Server',
        purpose: 'Check the server, restart it when it acts up, and shut it down properly when it must be powered off.',
        steps: [
          'Open Raspberry Pi 4 Server and read its state, uptime, temperature and memory.',
          'To restart, select Restart and complete the confirmation: the web app comes back by itself in about 2 minutes.',
          'Before a shutdown, tell the farm team: monitoring stops until it is switched on again.',
          'Select Shut down and complete the confirmation.',
          'Wait until the page reports the shutdown is complete before unplugging the power.',
        ],
        features: 'The page follows each restart or shutdown to the end and reports if it failed.',
        note: 'Unplugging the Raspberry Pi is not a shutdown and can damage the memory card.',
      },
      tl: {
        title: 'Raspberry Pi 4 Server', screen: 'Raspberry Pi 4 Server',
        purpose: 'Tingnan ang server, i-restart kapag nagloloko, at i-shutdown nang maayos kapag kailangang patayin.',
        steps: [
          'Buksan ang Raspberry Pi 4 Server at basahin ang lagay, uptime, init at memory.',
          'Para mag-restart, pindutin ang Restart at sagutin ang tanong: babalik mag-isa ang web app sa loob ng mga 2 minuto.',
          'Bago i-shutdown, sabihan ang mga tao sa farm: titigil ang pagbabantay hanggang buksan ulit.',
          'Pindutin ang Shut down at sagutin ang tanong para sigurado.',
          'Hintaying sabihin ng page na tapos na ang shutdown bago hugutin ang saksakan.',
        ],
        features: 'Sinusundan ng page ang bawat restart o shutdown hanggang matapos at sasabihin kung pumalya.',
        note: 'Ang paghugot ng saksakan ng Raspberry Pi ay hindi shutdown at pwedeng masira ang memory card.',
      },
      taglish: {
        title: 'Raspberry Pi 4 Server', screen: 'Raspberry Pi 4 Server',
        purpose: 'I-check ang server, i-restart kapag nagloloko, at i-shutdown nang maayos kapag kailangang i-off.',
        steps: [
          'I-open ang Raspberry Pi 4 Server at basahin ang state, uptime, temperature at memory.',
          'Para mag-restart, i-click ang Restart at i-complete ang confirmation: babalik by itself ang web app in about 2 minutes.',
          'Bago mag-shutdown, i-inform ang farm team: titigil ang monitoring hanggang i-on ulit.',
          'I-click ang Shut down at i-complete ang confirmation.',
          'Hintaying sabihin ng page na complete na ang shutdown bago i-unplug.',
        ],
        features: 'Sinusundan ng page ang bawat restart o shutdown hanggang matapos at nire-report kung nag-fail.',
        note: 'Ang pag-unplug ng Raspberry Pi ay hindi shutdown at pwedeng masira ang memory card.',
      },
    },
  ],
};

const ROLE_ORDER = ['agronomist', 'farm_owner', 'field_staff', 'admin'];

/// A section in one language: shared fields (id, tab, shots) + that language's text.
export function tr(section, lang) {
  const t = section[lang] || section.en;
  return { id: section.id, tab: section.tab, shots: section.shots || [], ...t };
}

/// Groups of sections for one role, or for every role ('all', printed manual).
export function manualGroups(role, lang = 'en') {
  const L = UI[lang] || UI.en;
  const roleGroups = role === 'all'
    ? ROLE_ORDER.map((r) => ({ title: L.roleScreens(ROLE_NAMES[r]), role: r, items: ROLE_SECTIONS[r] }))
    : [{ title: L.yourScreens(ROLE_NAMES[role]), role, items: ROLE_SECTIONS[role] || [] }];
  return [
    { title: L.gettingStarted, items: GETTING_STARTED },
    ...roleGroups,
    { title: L.help, items: CLOSING },
  ].map((g) => ({ ...g, items: g.items.map((s) => tr(s, lang)) }));
}

/// Flat list of book pages. A section with two screenshots takes two pages.
export function buildPages(role, lang = 'en') {
  const groups = manualGroups(role, lang);
  const pages = [{ kind: 'cover' }, { kind: 'contents' }, { kind: 'about' }];
  let n = 0;
  for (const g of groups) {
    g.items.forEach((s, gi) => {
      n += 1;
      const shots = s.shots || [];
      const base = { section: s, number: n, group: g.title, groupStart: gi === 0, role: g.role };
      if (shots.length <= 1) pages.push({ kind: 'section', ...base, shot: shots[0], part: 'full' });
      else {
        pages.push({ kind: 'section', ...base, shot: shots[0], part: 'first' });
        shots.slice(1).forEach((sh) => pages.push({ kind: 'section', ...base, groupStart: false, shot: sh, part: 'rest' }));
      }
    });
  }
  pages.push({ kind: 'back' });
  // even page count so the back cover closes the book
  if (pages.length % 2 === 1) pages.splice(pages.length - 1, 0, { kind: 'notes' });
  return pages;
}
