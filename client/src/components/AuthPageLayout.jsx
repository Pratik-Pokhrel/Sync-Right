import logo from '../assets/logo.ico';

const AuthPageLayout = ({ title, subtitle, children }) => {
  return (
    <div className="auth-page">
      <div className="auth-brand"><img src={logo} alt="Sync-Right" /></div>
      <div className="auth-layout">
        <div className="auth-intro">
          <p className="eyebrow">A calmer way to collaborate</p>
          <h1>Make space for better work.</h1>
          <p>Gather your people, ideas, and conversations in one shared room.</p>
          <div className="auth-note"><span>Private rooms, real-time chat, and a shared whiteboard.</span></div>
        </div>
        <div className="auth-form">
          <p className="eyebrow">Welcome back</p>
          <h2>{title}</h2>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthPageLayout;
