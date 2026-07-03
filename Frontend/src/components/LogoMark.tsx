import logo from '../assets/logo.png';

type LogoMarkProps = {
  className?: string;
};

export default function LogoMark({ className = 'h-8 w-8' }: LogoMarkProps) {
  return (
    <div className={`shrink-0 overflow-hidden rounded-full ${className}`}>
      <img alt="ToliarEvent" className="h-full w-full object-cover" src={logo} />
    </div>
  );
}
