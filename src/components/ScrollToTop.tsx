import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect /home to / (broken page fix)
    if (pathname === '/home' || pathname === '/home/') {
      navigate('/', { replace: true });
      return;
    }
    
    // Redirect /contact to /contact-us/ (broken page fix)
    if (pathname === '/contact' || pathname === '/contact/') {
      navigate('/contact-us/', { replace: true });
      return;
    }
    
    // Redirect broken portfolio page to homepage
    if (pathname === '/portfolio/car-front-side' || pathname === '/portfolio/car-front-side/') {
      navigate('/', { replace: true });
      return;
    }
    
    // Redirect old EV warranty URL to new URL
    if (pathname === '/best-warranty-on-ev-cars-uk-warranties' || pathname === '/best-warranty-on-ev-cars-uk-warranties/') {
      navigate('/ev-warranty/', { replace: true });
      return;
    }
    
    // Redirect old van warranty URL to van warranty page
    if (pathname === '/van-warranty-companies-uk-warranties' || pathname === '/van-warranty-companies-uk-warranties/') {
      navigate('/van-warranty/', { replace: true });
      return;
    }
    
    // Redirect URLs without trailing slash to include trailing slash
    if (pathname !== '/' && !pathname.endsWith('/')) {
      navigate(pathname + '/', { replace: true });
      return;
    }
    
    // Scroll to top when pathname changes
    window.scrollTo(0, 0);
  }, [pathname, navigate]);

  return null;
};

export default ScrollToTop;