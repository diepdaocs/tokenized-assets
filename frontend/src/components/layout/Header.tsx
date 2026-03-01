import { Link } from 'react-router-dom';
import ConnectWallet from '../wallet/ConnectWallet';

export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="header-logo">
          <span className="logo-icon">T</span>
          <span className="logo-text">Tokenized Assets</span>
        </Link>
      </div>
      <div className="header-right">
        <ConnectWallet />
      </div>
    </header>
  );
}
