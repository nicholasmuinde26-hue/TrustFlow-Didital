/**
 * Magnetic — intentionally minimal.
 *
 * The pointer-pull effect was interfering with buttons, so this is now a
 * pure pass-through: it renders its child exactly as given, with no
 * wrapper element, no listeners and no movement. Call sites
 * (<Magnetic strength={0.4}>…</Magnetic>) keep working unchanged, and the
 * buttons keep their own CSS hover lift/glow.
 */
export default function Magnetic({ children }) {
  return children;
}
