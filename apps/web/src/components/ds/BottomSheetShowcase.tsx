import { DsBottomSheetPanel } from "./BottomSheet";
import "./BottomSheetShowcase.css";

/**
 * Each variant is rendered inside a device-frame container (390 px wide, background
 * representing the scrim/screen behind the sheet) so the panel structure is visible
 * directly on the page — matching how Figma's component page presents the component.
 */
function DeviceFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="bs-showcase__device-figure">
      <figcaption className="bs-showcase__device-label">{label}</figcaption>
      <div className="bs-showcase__device-frame" aria-label={label}>
        <div className="bs-showcase__device-screen" aria-hidden />
        <div className="bs-showcase__device-sheet">{children}</div>
      </div>
    </figure>
  );
}

export function BottomSheetShowcase() {
  return (
    <div className="bs-showcase" aria-label="Bottom Sheet variants">
      <p className="bs-showcase__hint">
        Figma DS Starter Kit <span className="bs-showcase__mono">8Ry9Oa2niLBGvoWPo9rLQT</span>,
        node <span className="bs-showcase__mono">2461:97</span>. Boolean axes:{" "}
        <span className="bs-showcase__mono">actions</span> ·{" "}
        <span className="bs-showcase__mono">secondaryAction</span> ·{" "}
        <span className="bs-showcase__mono">showActionSlot</span> ·{" "}
        <span className="bs-showcase__mono">topRightSlot1</span>.
      </p>

      {/* ── Row 1: core variants ── */}
      <section className="bs-showcase__section" aria-labelledby="bs-core-heading">
        <h3 id="bs-core-heading" className="bs-showcase__section-title">
          Default · With actions
        </h3>
        <div className="bs-showcase__row">
          <DeviceFrame label="Default (actions=false)">
            <DsBottomSheetPanel isStatic />
          </DeviceFrame>

          <DeviceFrame label="Primary action only (secondaryAction=false)">
            <DsBottomSheetPanel
              isStatic
              actions
              secondaryAction={false}
              primaryLabel="Primary Action"
            />
          </DeviceFrame>

          <DeviceFrame label="Primary + Secondary (default secondaryAction=true)">
            <DsBottomSheetPanel
              isStatic
              actions
              secondaryAction
              primaryLabel="Primary Action"
              secondaryLabel="Secondary Action"
            />
          </DeviceFrame>
        </div>
      </section>

      {/* ── Row 2: top-right slot + action slot ── */}
      <section className="bs-showcase__section" aria-labelledby="bs-slots-heading">
        <h3 id="bs-slots-heading" className="bs-showcase__section-title">
          Top-right slot · Action slot
        </h3>
        <div className="bs-showcase__row">
          <DeviceFrame label="Close icon (topRightSlot1=true)">
            <DsBottomSheetPanel
              isStatic
              showCloseIcon
              actions
              secondaryAction
              primaryLabel="Primary Action"
              secondaryLabel="Secondary Action"
            />
          </DeviceFrame>

          <DeviceFrame label="Action slot (showActionSlot=true)">
            <DsBottomSheetPanel
              isStatic
              actions
              secondaryAction
              showActionSlot
              actionSlot={
                <div className="bs-showcase__action-slot-placeholder" aria-label="Action slot" />
              }
              primaryLabel="Primary Action"
              secondaryLabel="Secondary Action"
            />
          </DeviceFrame>
        </div>
      </section>
    </div>
  );
}
