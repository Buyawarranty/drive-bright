import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      visibleToasts={1}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#FF385C] group-[.toaster]:text-white group-[.toaster]:border-[#FF385C] group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-white/90",
          actionButton:
            "group-[.toast]:bg-white group-[.toast]:text-[#FF385C] hover:bg-white/90",
          cancelButton:
            "group-[.toast]:bg-white/20 group-[.toast]:text-white hover:bg-white/30",
          closeButton: "group-[.toast]:text-white hover:bg-white/20",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
