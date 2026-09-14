import Link from 'next/link';
import './neon-landing.css';

/**
 * Content24 — Marketspace · Classic Neon landing page.
 * DOM and class names come verbatim from the approved design handoff
 * (design_handoff_neon_landing/drop-in). Every style value lives in
 * neon-landing.css; nothing here is computed at runtime.
 *
 * Deviations from the handoff, all deliberate:
 *  - the handoff emitted two `className` attributes on each <i> (invalid JSX);
 *    the icon and layout classes are merged into one.
 *  - decorative layers carry aria-hidden and the phone is a labelled role="img",
 *    so its fake "Log in" / "Register" pills are not announced as controls.
 *  - the #download / #contact placeholders are wired to real routes.
 */
export default function NeonLanding() {
  return (
      <div className="nx-root nx-001" id="top">

        {/* ambient light wisps */}
        <div className="nx-002" aria-hidden="true">
          <div className="nx-003"></div>
          <div className="nx-004"></div>
          <div className="nx-005"></div>
          <div className="nx-006"></div>
          <div className="nx-007"></div>

          <div className="nx-008">
            <div className="nx-009"></div>
            <div className="nx-010"></div>
            <div className="nx-011"></div>
            <div className="nx-012"></div>
            <div className="nx-013"></div>
          </div>

          <div className="nx-014"></div>
          <div className="nx-015"></div>

          <div className="nx-016"></div>
          <div className="nx-017"></div>
          <div className="nx-018"></div>
          <div className="nx-019"></div>
          <div className="nx-020"></div>
          <div className="nx-021"></div>

          <div className="nx-022"></div>
          <div className="nx-023"></div>
          <div className="nx-024"></div>
          <div className="nx-025"></div>
          <div className="nx-026"></div>
          <div className="nx-027"></div>
          <div className="nx-028"></div>
          <div className="nx-029"></div>
          <div className="nx-030"></div>
          <div className="nx-031"></div>
          <div className="nx-032"></div>
          <div className="nx-033"></div>
          <div className="nx-034"></div>
          <div className="nx-035"></div>

          <div className="nx-036">
            <div className="nx-037"></div>
            <div className="nx-038"></div>
            <div className="nx-039"></div>
            <div className="nx-040"></div>
            <div className="nx-041"></div>
            <div className="nx-042"></div>
            <div className="nx-043"></div>
            <div className="nx-044"></div>
            <div className="nx-045"></div>
            <div className="nx-046"></div>
          </div>
          <div className="nx-047"></div>
          <div className="nx-048"></div>
          <div className="nx-049"></div>
          <div className="nx-050"></div>
          <div className="nx-051"></div>
          <div className="nx-052"></div>
          <div className="nx-053"></div>
        </div>

        {/* NAV */}
        <div className="nx-054">
          <img src="/icon-512.png" alt="Content24 Marketspace" className="nx-055" />
          <div className="nx-056">
            <div className="nx-057">CONTENT<span className="nx-058">24</span></div>
            <div className="nx-059">— MARKETSPACE —</div>
          </div>
          <div className="nx-060">
            <a href="#top" className="nx-061">Home</a>
            <a href="#about" className="nx-062">Over ons</a>
            <a href="#how" className="nx-063">Hoe het werkt</a>
            <a href="#functies" className="nx-064">Functies</a>
            <a href="#contact" className="nx-065">Contact</a>
          </div>
          <Link href="/login" className="nx-066">Download App</Link>
        </div>

        {/* HERO */}
        <div className="nx-067" id="about">

          <div className="nx-068" role="img" aria-label="The Content24 Marketspace app shown on a phone">
            <div className="nx-069"></div>
            <div className="nx-070"><i className="ti ti-lock nx-071"></i></div>
            <div className="nx-072">
              <div className="nx-073"></div>
              <div className="nx-074"></div>
              <div className="nx-075"></div>
              <div className="nx-076">
              <div className="nx-077">
              <div className="nx-078">
                <div className="nx-079"></div>
                <img src="/icon-512.png" alt="" className="nx-080" />
                <div className="nx-081">CONTENT<span className="nx-082">24</span></div>
                <div className="nx-083">— MARKETSPACE —</div>
                <div className="nx-084">Log in</div>
                <div className="nx-085">Register</div>
                <div className="nx-086">
                  <div className="nx-087"></div>
                  <div className="nx-088">
                    <div className="nx-089">
                      <div className="nx-090"></div>
                      <div className="nx-091"></div>
                    </div>
                    <div className="nx-092">
                      <div className="nx-093"></div>
                      <div className="nx-094">
                        <span className="nx-095">24</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="nx-096"></div>
                </div>
              </div>
              </div>
              <div className="nx-097"></div>
            </div>
          </div>

          <div className="nx-098">
            <h1 className="nx-099">
              <span className="nx-100">Content</span><br />
              <span className="nx-101">24 hour</span><br />
              <span className="nx-102">group box.</span><br />
              <span className="nx-103">Your world.</span><br />
              <span className="nx-104">Your content.</span>
            </h1>
            <p className="nx-105">Exclusive content from creators in private groups. 24 hours access. No limits.</p>
            <div className="nx-106" id="download">
              <a href="#download" className="nx-107"><i className="ti ti-brand-apple nx-108" aria-hidden="true"></i><span><span className="nx-109">Download on the</span><span className="nx-110">App Store</span></span></a>
              <a href="#download" className="nx-111"><i className="ti ti-brand-google-play nx-112" aria-hidden="true"></i><span><span className="nx-113">Get it on</span><span className="nx-114">Google Play</span></span></a>
            </div>
          </div>
        </div>

        {/* FEATURES */}
        <div className="nx-115" id="functies">
          <div className="nx-116">
            <div className="nx-117"><i className="ti ti-lock nx-118" aria-hidden="true"></i></div>
            <div className="nx-119">24H ACCESS</div>
          </div>
          <div className="nx-120">
            <div className="nx-121"><i className="ti ti-cloud-upload nx-122" aria-hidden="true"></i></div>
            <div className="nx-123">SAFE &amp; PRIVATE</div>
          </div>
          <div className="nx-124">
            <div className="nx-125"><i className="ti ti-users nx-126" aria-hidden="true"></i></div>
            <div className="nx-127">CREATORS</div>
          </div>
          <div className="nx-128">
            <div className="nx-129"><i className="ti ti-credit-card nx-130" aria-hidden="true"></i></div>
            <div className="nx-131">SECURE PAYMENTS</div>
          </div>
        </div>

        {/* INVITE BAND */}
        <div className="nx-132" id="how">
          <div className="nx-133" aria-hidden="true"></div>
          <div className="nx-134" aria-hidden="true">
            <div className="nx-135">
              <div className="nx-136">
                <div className="nx-137"></div>
                <div className="nx-138"></div>
                <div className="nx-139"></div>
                <div className="nx-140"></div>
                <div className="nx-141"></div>
                <div className="nx-142"></div>

                <div className="nx-143"></div>
                <div className="nx-144"></div>
                <div className="nx-145"></div>
                <div className="nx-146"></div>
                <div className="nx-147"></div>
                <div className="nx-148"></div>
                <div className="nx-149"></div>
                <div className="nx-150"></div>
                <div className="nx-151"></div>

                <div className="nx-152">
                  <div className="nx-153"></div>
                  <div className="nx-154"></div>
                  <div className="nx-155"></div>
                  <div className="nx-156"></div>
                  <div className="nx-157"></div>
                  <div className="nx-158"></div>
                  <div className="nx-159"></div>
                  <div className="nx-160"></div>
                  <div className="nx-161"></div>
                  <div className="nx-162"></div>
                  <div className="nx-163"></div>
                  <div className="nx-164"></div>
                  <div className="nx-165"></div>
                  <div className="nx-166"></div>
                  <div className="nx-167"></div>
                </div>
              </div>
            </div>
            <div className="nx-168">
              <div className="nx-169"></div>
              <div className="nx-170"></div>
            </div>
            <div className="nx-171">
              <div className="nx-172"></div>
              <div className="nx-173">
                <span className="nx-174">24</span>
              </div>
            </div>
          </div>
          <div className="nx-175">
            <div className="nx-176"><span className="nx-177">Invite</span> <span className="nx-178">-</span> <span className="nx-179">Drop</span> <span className="nx-180">-</span> <span className="nx-181">Earn</span></div>
            <div className="nx-182">Invite your friends, drop content and earn together.</div>
          </div>
          <Link href="/login" className="nx-183" aria-label="Get started"><i className="ti ti-arrow-right nx-184" aria-hidden="true"></i></Link>
        </div>

        {/* FOOTER */}
        <div className="nx-185" id="contact">
          <Link href="/legal/terms" className="nx-186">Terms</Link>
          <Link href="/legal/privacy" className="nx-187">Privacy</Link>
          <Link href="/legal/2257" className="nx-188">Age records</Link>
          <Link href="/legal/dmca" className="nx-189">DMCA</Link>
          <Link href="/legal/refunds" className="nx-190">Refunds</Link>
          <span className="nx-191">Adults only (18+). Creators are identity-verified before publishing.</span>
        </div>

      </div>
  );
}
