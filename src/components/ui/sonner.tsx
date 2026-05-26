import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      offset={16}
      visibleToasts={1}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#FF385C] group-[.toaster]:text-white group-[.toaster]:border-[#FF385C] group-[.toaster]:shadow-lg group-[.toaster]:pr-10",
          description: "group-[.toast]:text-white/90",
          actionButton:
            "group-[.toast]:bg-white group-[.toast]:text-[#FF385C] hover:bg-white/90",
          cancelButton:
            "group-[.toast]:bg-white/20 group-[.toast]:text-white hover:bg-white/30",
          closeButton:
            "group-[.toast]:!bg-white/20 group-[.toast]:!text-white group-[.toast]:!border-white/30 hover:group-[.toast]:!bg-white/30 group-[.toast]:!left-auto group-[.toast]:!right-2 group-[.toast]:!top-2 group-[.toast]:!opacity-100 group-[.toast]:!transform-none",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
