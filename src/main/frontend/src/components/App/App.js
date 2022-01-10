import { h } from 'preact';
import { useReducer } from 'preact/hooks';
import { Features } from '../Features/Features';
import { GeneratedProject } from '../GeneratedProject/GeneratedProject';
import { Nav } from '../Nav/Nav';
import { defaultState } from './defaultState';

const mergeState = (state, action) => {
    const segments = action.type.split('.');
    switch (segments.length) {
        case 1:
            return {
                ...state,
                [action.type]: action.value,
            };
        case 2:
            const child = state[segments[0]];
            return {
                ...state,
                [segments[0]]: {
                    ...(child || {}),
                    [segments[1]]: action.value,
                },
            };
        default:
            throw new Error(`invalid action type: ${action.type}`);

    }
};

export const App = () => {
    const [state, dispatch] = useReducer((state, action) => mergeState(state, action), defaultState);
    return (
        <div className="project-starter container">
            <div style={{ marginRight: '0', marginLeft: '0' }}>
                <div>
                    <Nav data={state.nav} dispatch={dispatch} />
                </div>
                <div>
                    <Features data={state.features} dispatch={dispatch} />
                </div>
            </div>
            <div style={{ width: '100%' }}>
                <GeneratedProject dispatch={dispatch} data={state} />
            </div>
        </div>
    );
};
