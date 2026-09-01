import { Outlet, useLocation } from 'react-router-dom';

import TopBar from './TopBar';

import Footer from './Footer';

import { isMarketingPage, isPublicShellPage } from '../utils/publicPages';



export default function PublicLayout() {

  const { pathname } = useLocation();

  const shell = isPublicShellPage(pathname);

  const marketing = isMarketingPage(pathname);



  return (

    <>

      <TopBar />

      <main

        className={`min-h-screen flex flex-col ${

          shell ? 'bg-[var(--landing-bg)]' : 'pt-24 bg-background'

        } ${shell && !marketing ? 'pt-20' : ''}`}

      >

        <div className="flex-1">

          <Outlet />

        </div>

        <Footer />

      </main>

    </>

  );

}

