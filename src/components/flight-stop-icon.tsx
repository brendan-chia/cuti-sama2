import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';

const backgrounds = [colors.surfaceTint, colors.sun, colors.sand, colors.surfaceTint, colors.leaf, colors.sand];

/** Small travel stickers, ordered to match the flight-plan reference. */
export function FlightStopIcon({ index }: { index: number }) {
  return <Svg width={38} height={38} viewBox="0 0 48 48" aria-hidden={true}>
    <Circle cx="24" cy="24" r="22" fill={backgrounds[index]} />
    <G stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {index === 0 ? <>
        <Rect x="11" y="12" width="26" height="27" rx="4" fill="#FFF9E5" />
        <Path d="M11 20H37M18 9V15M30 9V15" fill="none" />
        <Path d="M16 26L18 28L22 24M27 26H31M17 33H20M27 33H31" fill="none" />
      </> : null}
      {index === 1 ? <>
        <Path d="M24 8V40M17 40H31" fill="none" />
        <Path d="M12 13H32L38 18L32 23H12Z" fill="#FFF3BD" />
        <Path d="M35 27H15L9 32L15 37H35Z" fill={colors.surfaceTint} />
      </> : null}
      {index === 2 ? <>
        <Rect x="9" y="10" width="30" height="29" rx="4" fill="#FFF9E5" />
        <Circle cx="29" cy="19" r="4" fill={colors.orange} stroke="none" />
        <Path d="M11 34L20 23L27 30L31 25L37 32V37H11Z" fill={colors.leaf} />
      </> : null}
      {index === 3 ? <>
        <Path d="M12 16L31 10V21H12Z" fill="#FFF0C4" />
        <Rect x="9" y="17" width="29" height="22" rx="4" fill={colors.leaf} />
        <Path d="M30 24H40V33H30Q26 28.5 30 24Z" fill={colors.surfaceTint} />
        <Circle cx="32" cy="28.5" r="1.4" fill={colors.ink} stroke="none" />
      </> : null}
      {index === 5 ? <><Rect x="10" y="19" width="28" height="20" rx="4" fill="#FFF9E5" /><Path d="M18 19V12H30V19M17 23V35M31 23V35" fill="none" /></> : null}
      {index === 4 ? <>
        <Path d="M15 10H33Q36 10 36 13V37L25 32L14 38V13Q14 10 17 10Z" fill="#FFF0BE" />
        <Path d="M18 12V30" stroke="#FFFFFF" />
      </> : null}
    </G>
  </Svg>;
}
