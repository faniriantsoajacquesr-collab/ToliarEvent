import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import Footer from './Footer';

export default function PublicLayout() {
  return (
    <>
      <TopBar />
      <main className="pt-24 min-h-screen flex flex-col">
        <div className="flex-1">
          <Outlet />
        </div>
        <Footer />
      </main>
    </>
  );
}
