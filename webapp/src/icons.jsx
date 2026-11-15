// One icon per meaning, used everywhere (Phosphor Icons, bundled into the
// build, so nothing loads from the internet). Size and weight come from the
// IconContext in main.jsx; pass size / weight to override one use.
export {
  SquaresFourIcon as IconDashboard,
  MapTrifoldIcon as IconMap,
  BellIcon as IconAlerts,
  CaretDownIcon as IconCaretDown,
  CaretRightIcon as IconCaretRight,
  DropIcon as IconWater,
  ChartLineUpIcon as IconAnalytics,
  BroadcastIcon as IconBoxes,
  ClockCounterClockwiseIcon as IconAudit,
  HardDrivesIcon as IconServer,
  ThermometerSimpleIcon as IconTemperature,
  CloudRainIcon as IconHumidity,
  PlantIcon as IconSoil,
  LeafIcon as IconLeaf,
  ShieldCheckIcon as IconShield,
  UsersThreeIcon as IconUsers,
  UserIcon as IconUser,
  KeyIcon as IconKey,
  LockSimpleIcon as IconLock,
  LockSimpleOpenIcon as IconUnlock,
  PencilSimpleIcon as IconEdit,
  TrashIcon as IconDelete,
  CheckIcon as IconCheck,
  CheckCircleIcon as IconCheckCircle,
  XIcon as IconClose,
  XCircleIcon as IconXCircle,
  WarningIcon as IconWarning,
  WarningCircleIcon as IconWarningCircle,
  PowerIcon as IconPower,
  SignOutIcon as IconSignOut,
  SignInIcon as IconSignIn,
  ArrowClockwiseIcon as IconRefresh,
  DownloadSimpleIcon as IconDownload,
  PlusIcon as IconAdd,
  MinusIcon as IconRemove,
  GearSixIcon as IconSettings,
  RepeatIcon as IconRule,
  ClockIcon as IconClock,
  PipeIcon as IconValve,
  FireIcon as IconHeat,
  SparkleIcon as IconSuggest,
  InfoIcon as IconInfo,
  PlugsIcon as IconPlug,
  WifiHighIcon as IconOnline,
  WifiSlashIcon as IconOffline,
  CpuIcon as IconChip,
  FileTextIcon as IconReport,
  EnvelopeIcon as IconMail,
  ProhibitIcon as IconBlocked,
  ArrowsClockwiseIcon as IconSync,
  HandTapIcon as IconTap,
  ListChecksIcon as IconChecklist,
  CircleIcon as IconDot,
  MapPinIcon as IconPin,
  ChartBarIcon as IconBars,
  CalendarBlankIcon as IconCalendar,
  TimerIcon as IconTimer,
  CoffeeIcon as IconCoffee,
  BookOpenTextIcon as IconManual,
  CaretLeftIcon as IconCaretLeft,
  GridFourIcon as IconThumbs,
  MagnifyingGlassPlusIcon as IconZoomIn,
  MagnifyingGlassMinusIcon as IconZoomOut,
  ArrowsOutIcon as IconFullscreen,
  ArrowsInIcon as IconFullscreenExit,
  SpeakerHighIcon as IconSound,
  SpeakerSlashIcon as IconMute,
  PrinterIcon as IconPrint,
  TextAlignLeftIcon as IconTextView,
  BookOpenIcon as IconBookView,
} from '@phosphor-icons/react';

/// FarmSense mark: a coffee leaf with a ripe cherry, drawn for this app.
export function BrandMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M6 25C6 13 13 6 26 5c1 11-5 20-17 21-1.2 0-2.2-.4-3-1Z"
        fill="currentColor" opacity="0.9"
      />
      <path d="M8.5 23.5C12 18 16.5 13 22 9" stroke="#17321f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="23" cy="23" r="5" fill="#c0392b" />
      <circle cx="21.4" cy="21.4" r="1.3" fill="#fff" opacity="0.55" />
    </svg>
  );
}
