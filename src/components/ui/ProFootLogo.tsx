import Image from "next/image";

interface ProFootLogoProps {
  className?: string;
  size?: number;
}

export function ProFootLogo({ className = "w-6 h-6", size = 40 }: ProFootLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="ProFoot AI Logo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}
