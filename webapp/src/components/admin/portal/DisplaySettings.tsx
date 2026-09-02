import { ToggleRow } from "@/components/dashboard/forms";
import { InfoNote } from "@/components/dashboard/Panel";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";

/**
 * Display settings for staff — Admin → Security settings.
 *
 * WHY THIS EXISTS SEPARATELY from the customer `PreferencesPanel`: the display
 * classes (`pb-high-contrast`, `pb-large-text`, …) are applied to <html>, so
 * they follow the browser into the Admin Console even though nothing in the
 * console put them there. Turning High contrast on anywhere — including the
 * first-use accessibility questions on a demo portal — repaints the console
 * too, and until now there was no control here to turn it back off.
 *
 * SAVED IN THIS BROWSER ONLY, and that is a constraint rather than a choice.
 * `UserPreference` is keyed to `User.id` and `/api/preferences` is guarded by
 * `requireUser()`, which reads the CUSTOMER session; staff are a separate
 * `AdminUser` model with no preferences row of their own. `PreferencesProvider`
 * already handles this correctly — its server query is `enabled: signedIn` and
 * `persist()` only calls the API when a customer session exists — so on a
 * staff-only browser these toggles write to localStorage and nothing 401s.
 * Giving staff durable settings means an `AdminPreference` table; until that
 * exists, the footer says plainly where the setting lives.
 *
 * Only the four settings that change how the CONSOLE looks are here. Language,
 * read-aloud, support channel and assisted onboarding are customer concerns
 * with no meaning for an operations administrator.
 */
export function AdminDisplaySettings() {
  const { prefs, update } = usePreferences();

  return (
    <div className="space-y-4">
      <div className="divide-y divide-border/70">
        <ToggleRow
          title="High contrast"
          description="Pure black background and white text, with stronger borders. Turn this off to return to the standard navy theme."
          checked={prefs.highContrast}
          onChange={(highContrast) => update({ highContrast })}
          stateLabels={["On", "Off"]}
        />
        <ToggleRow
          title="Bigger writing"
          description="Increases every text size, spacing and touch target across the console together."
          checked={prefs.largeText}
          onChange={(largeText) => update({ largeText })}
          stateLabels={["On", "Off"]}
        />
        <ToggleRow
          title="Reduce motion"
          description="Removes transitions and animated reveals."
          checked={prefs.reduceMotion}
          onChange={(reduceMotion) => update({ reduceMotion })}
          stateLabels={["On", "Off"]}
        />
        <ToggleRow
          title="Simple view"
          description="Strips decorative detail back to the essentials."
          checked={prefs.simpleView}
          onChange={(simpleView) => update({ simpleView })}
          stateLabels={["On", "Off"]}
        />
      </div>

      <InfoNote>
        Saved in this browser only — staff display settings are not stored against your PayBridge administrator
        account, so you would set them again on another computer. They apply to every PayBridge page open in this
        browser, not just the Admin Console.
      </InfoNote>
    </div>
  );
}
