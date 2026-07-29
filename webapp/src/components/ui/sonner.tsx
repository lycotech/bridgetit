import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          /* Something worked — the one toast state that earns the teal. */
          success:
            "group-[.toaster]:border-success/40 group-[.toaster]:bg-success/[0.08] [&_[data-icon]]:text-success",
          error: "group-[.toaster]:border-destructive/40 group-[.toaster]:bg-destructive/[0.07]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
