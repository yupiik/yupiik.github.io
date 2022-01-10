import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';

const is = value => value == true || value == 'true';

const Tooltip = ({ children, tooltip }) => {
    const [hover, setHover] = useState(false);
    return (
        <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
            position: 'relative',
            display: 'inline-block',
        }}>
            {children}
            {hover && <span style={{
                width: '300px',
                opacity: 0.7,
                backgroundColor: 'black',
                color: '#fff',
                textAlign: 'center',
                padding: '5px 0',
                borderRadius: '6px',
                position: 'absolute',
                zIndex: 1,
            }}>
                {tooltip}
            </span>}
        </div>
    );
};

const Feature = ({ label, id, dispatch, data }) => {
    const enabled = is(data[id].enabled);
    // const useParent = is(data[id].useParent);
    return (
        <div style={{ flex: 1, minWidth: '130px' }}>
            <div className="form-check-inline">
                <input
                    type="checkbox"
                    className="form-check-input"
                    checked={enabled}
                    id={id}
                    value={String(enabled)}
                    aria-describedby={id}
                    onChange={() => dispatch({
                        type: `features.${id}`,
                        value: {
                            ...data[id],
                            enabled: !enabled,
                        },
                    })} />
                <label for={id} className="form-check-label">
                    <Tooltip tooltip={data[id].tooltip}>
                        <i className={data[id].icon} /> {label}
                    </Tooltip>
                </label>
            </div>
            {/* for now the generator does not support that so keep a single module generation
            enabled && data[id].supportSubModule && <>
                <div className="ml-3">
                    <div className="form-check-inline">
                        <input
                            type="checkbox"
                            className="form-check-input"
                            checked={useParent}
                            id={`${id}_parent`}
                            value={useParent}
                            aria-describedby={id}
                            onChange={() => dispatch({
                                type: `features.${id}`,
                                value: {
                                    ...data[id],
                                    useParent: !useParent,
                                },
                            })} />
                        <label for={`${id}_parent`} className="form-check-label">
                            <i className="fa fa-sitemap mr-1" />
                            Multi {label}
                        </label>
                    </div>
                </div>
                </>*/}
        </div >
    );
};

export const Features = ({ dispatch, data }) => {
    return (
        <div>
            <div>
                <h3>Features</h3>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {Object.keys(data)
                    .sort((a, b) => a.order - b.order)
                    .map(key => <Feature label={data[key].label} id={key} dispatch={dispatch} data={data} />)}
            </div>
        </div>
    );
};
