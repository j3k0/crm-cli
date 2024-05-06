import Table from 'cli-table';
import moment from 'moment';
import { Database } from '../types';

export const defaultTableOptions = process.env.CSV ? {
    chars: {
        'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': '',
        'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': '',
        'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': '',
        'right': '' , 'right-mid': '' ,
        'middle': ','
    },
    style: {
        'padding-left': 0,
        'padding-right': 0,
        border: [], head: [], compact: true
    }
} : {
    chars: {'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''}
};

export const tableToString = (table: Table) => {
    if (process.env.CSV)
        return table.toString().replace(/ +/g, ' ').replace(/ ,/g, ',');
    else
        return table.toString();
}

export function fieldToText (data: Database, object: any, field: string): string {
    return ['date', 'created', 'upgraded', 'churned', 'followup'].indexOf(field) >= 0
        ? (object[field] && moment(new Date(object[field])).fromNow() || '')
        : field === 'from'
        ? data.config.staff[object.from] || object.from.split(/[@.]/)[0]
        : (object[field] || '');
}